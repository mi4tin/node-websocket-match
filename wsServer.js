//create time 2016年6月18日9:48:12
//author wsh
//消息服务
//应用场景：消息发送，游戏邀请
//待优化：每个用户

// 数据格式： {
//    fromId: "", //来源ID
//    toId: 0, //接收对象 0广播---toId>0则toDomain忽略
//    toDomain: '',//发送域，空为所有
//    toWaitMatch: '',//是否为等待匹配，空为所有
//    cmd: '', //命令
//    data: "" //消息内容
//   }

//---日志
const log4js = require('log4js');
log4js.configure({
    appenders: {
        info: {
            type: "dateFile",
            filename: 'info',
            pattern: "yyyyMMdd.log",
            alwaysIncludePattern: true//如果为true，则每个文件都会按pattern命名，否则最新的文件不会按照pattern命名
        },
        error: {
            type: "dateFile",
            filename: 'error',
            pattern: "yyyyMMdd.log",
            alwaysIncludePattern: true//如果为true，则每个文件都会按pattern命名，否则最新的文件不会按照pattern命名
        }
    },
    categories: {
        default: { appenders: ['info'], level: 'info' },//level表示最低等级
        error: { appenders: ['error'], level: 'error' }
    }
});

const infoLogo = log4js.getLogger('info');
const errorLogo = log4js.getLogger('error');
var logger = {
    info: function (lg) {
        infoLogo.info(lg);
    },
    error: function (lg) {
        errorLogo.error(lg);
    }
}
//---日志 end

//--全局异常捕获
process.on('uncaughtException', function (err) {
    //打印出错误
    logger.error(err);
});

var _tool = require('./tool.js');//加载js文件
//var db = require('./db.js');//加载js文件
var _WebSocketServer = require('websocket').server;
var _http = require('http');
var _heartbeat = 'heartbeat';

//重写console.log
console.log = (function (oriLogFunc) {
    return function (str) {
        oriLogFunc.call(console, str, _tool.getFullNowTime());
    }
})(console.log);

var _server = _http.createServer(function(request, response) {
});
_server.listen(1460, function() { });

// create the server
var _wsServer = new _WebSocketServer({
    httpServer: _server
});

// store all connected _clients
var _clients = [];//{ conn: connection, id: id,domain:domain,userid:userid }
var i = 0;
console.log('start time:');
_wsServer.on('request', function(request) {
    
    //获取用户连接信息
    var connection = request.accept(null, request.origin);
    var id = i;
    console.log('conn domain/userid:' + request.resource); 
    var resource = request.resource.split('/');
    var domain = resource[1];//域，如聊天域、游戏域等(同一域下每个用户只能出现一次)
    var userid = resource[2];
    var groupid = resource.length >= 4 ? resource[3] : '';//组id:时间戳+变量，建议时间戳+域(保证本服唯一)
    //重连：客户端缓存所有匹配的相关信息，据此判断重连是否可用

    //重复登陆处理，下线以前登陆
    isCanConn(domain, userid)

    var matchNum = resource.length >= 5 && !isNaN(resource[4]) ? Number(resource[4]) : 0;//Match需要数量
    var waitMatch = matchNum > 1;

    var userObj = {
        conn: connection,
        id: id, domain: domain, groupid: groupid, userid: userid,
        waitMatch: waitMatch, matchNum: matchNum//此处matchNum暂时未用
    }
    //匹配业务
    matchUsers(waitMatch, domain, groupid, userid);
    //缓存用户
    _clients.push(userObj);
    i++;
    //通知同域同组成员在线人数
    noticeOnlineNum(domain, groupid);
    // Simply pass any received messages onto all other _clients
    connection.on('message', function (message) {
	    if (message.type === 'utf8') {
            var datastr = message.utf8Data;
            if (_tool.isNullOrEmpty(datastr)) {
                return;
            } else {
                if (_heartbeat == datastr) {
                    connection.sendUTF(datastr);
                    return;
                }
                var data = JSON.parse(datastr);

                switch (data.cmd){
                    case "matchUsers":
                        matchUsers(true, domain, data.toGroupid, userid);
                        return;
                    case "updateCurUserWaitMatch":
                        userObj.waitMatch = data.waitMatch;
                        return;
                }

                var sendClients=null;
                if (data.toId > 0) {//从子集到父集执行
                    sendClients = getClientsByCondition(data.toWaitMatch, data.toDomain, '', data.toId);
                }
                else if (data.toGroupid !=null&& data.toGroupid.length > 0) {//对组发送
                    sendClients = getClientsByCondition(data.toWaitMatch, data.toDomain, data.toGroupid, '');
                }
                else if (data.toDomain!=null&&data.toDomain.length > 0) {//对域发送
                    sendClients = getClientsByCondition(data.toWaitMatch, data.toDomain);
                }
                if (sendClients != null) {
                    for (var i in sendClients) {
                        sendClients[i].conn.sendUTF(datastr);
                    }
                }
            }
        }
    });

    connection.on('close', function () {
        console.log('close');
        removeConn(domain, userid);
    });

    //匹配并更新用户waitMatch值
    function matchUsers(waitMatch, domain, groupid, userid) {
        if (waitMatch) { //寻找合适匹配对象
            var matchList = getClientsByCondition(true, domain, groupid, '');
            if (matchList.length == 0 && groupid.length == 0) {
                groupid = userid; //当没有等待匹配时，取第一成员userid作为groupid，类似主机用户
            } else {
                if (groupid.length == 0) {
                    groupid = matchList[0].groupid; //获取groupid，并作为小组groupid
                }
                if (matchList.length == matchNum - 1) {
                    //校验数量 matchNum>=2时
                    var ma;
                    if (matchNum >= 2 && matchNum - 1 == matchList.filter(function (ma) {
                        return ma.groupid == groupid;
                    }).length) {
                        console.log('num exception,start check');
                        for (var j = 0; j < matchNum - 1; j++) {
                            ma = matchList[j];
                            if (ma.groupid != groupid) {
                                ma.groupid = groupid;
                            }
                        }
                    }
                    //修改成员状态
                    for (var k = 0; k < matchNum - 1; k++) {
                        ma = matchList[k];
                        ma.waitMatch = false;
                    }
                    waitMatch = false; //更新当前用户waitMatch=false
                }
                //通知当前用户匹配到的用户list
                noticeMatchedList(connection, matchList);

                //群发给组新的匹配用户加入
                noticeChangeMatch(matchList, domain, groupid, userid);
            }
        }
        userObj.groupid = groupid;
        userObj.waitMatch = waitMatch;
    }
});

//移除连接
function removeConn(domain,userid) {
    var client;
    var conn = null;
    for (var i in _clients) {
        client = _clients[i];
        if (client.domain == domain && client.userid == userid) {
            console.log('remove domain:' + client.domain + '&userid:' + userid);
            conn = client.conn;
            _clients.splice(i, 1);
            //通知同域同组成员在线人数
            noticeOnlineNum(client.domain, client.groupid);

            if (client.matchNum > 0) {
                noticeChangeMatch(null, client.domain, client.groupid, client.userid*-1);//通知匹配下线
            }
            break;
        }
    }
    return conn;
}

//获取指定用户连接【未用】
function getConnByUserid(domain,userid) {
    var clients = getClientsByCondition(null, domain, userid);
    if (clients.length > 0) {
        return clients[0].conn;
    } else {
        return null;
    }
}

//获取指定用户
function getClientsByCondition(waitMatch, domain, groupid, userid) {
    if (!_tool.isNullOrEmpty(userid)) { //从子集到父集执行
        return _clients.filter(function (c) {
            return c.domain == domain && c.userid == userid && (waitMatch == null || c.waitMatch == waitMatch);
        });
    }
    else if (!_tool.isNullOrEmpty(groupid)) {
        return _clients.filter(function(c) {
            return c.domain == domain && c.groupid == groupid && (waitMatch == null || c.waitMatch == waitMatch);
        });
    } else {
        return _clients.filter(function (c) {
            return c.domain == domain && (waitMatch == null || c.waitMatch == waitMatch);
        });
    }
}

//通知聊天在线人数
function noticeOnlineNum(domain,  groupid) {
    var onlineNum = 0;
    if (groupid.length > 0) {//从子集到父集执行（groupid必须保证全网唯一）
        onlineNum = _clients.filter(function (x) {
            return x.groupid == groupid;
        }).length;
    } else {
        onlineNum = _clients.filter(function (x) {
            return x.domain == domain;
        }).length;
    }
    var sendData = {
        fromId: 'server', //来源ID
        toId: -1, //接收对象 0广播,-1服务端逻辑决定
        toDomain: domain,
        toGroupid: groupid,
        cmd: 'onlineNum', //命令
        data: onlineNum//消息内容
    }
    var sendClients = getClientsByCondition(null, domain, groupid);
    for (var i in sendClients) {
        sendClients[i].conn.sendUTF(JSON.stringify(sendData));
    }
}

var _matchCmd = "matchedList";//匹配用户
//匹配用户通知
function noticeChangeMatch(toList, domain, groupid, matchUserid) {
    if (toList == null) {
        toList = getClientsByCondition(null, domain, groupid, '');
    }
    var cmd = _matchCmd;
    if (matchUserid < 0) {
        matchUserid *= -1;
        cmd = "leaveMatch";
    }
    var sendData = {
        fromId: 'server', //来源ID
        toId: -1, //接收对象 0广播
        toDomain: domain,
        toGroupid: groupid,
        cmd: cmd, //命令
        data: [matchUserid]//消息内容   
    }
    for (var i in toList) {
        toList[i].conn.sendUTF(JSON.stringify(sendData));
    }
}

//通知匹配到的用户
function noticeMatchedList(toConn, matchedList) {
    if (matchedList.length == 0) {
        return;
    }
    var userids = [];
    for (var n = 0; n < matchedList.length; n++) {
        userids.push(matchedList[n].userid);
    }
    var sendData = {
        fromId: 'server', //来源ID
        toId: -1, //接收对象 0广播
        toDomain: '',
        toGroupid: '',
        cmd: _matchCmd, //命令
        data: userids//消息内容
    }
    toConn.sendUTF(JSON.stringify(sendData));
}

//确认是否已有连接，若已登陆，移除以前连接。并给以前连接发送rejectConn命令。以表示以前登陆被下线
function isCanConn(domain, userid) {
    var conn = removeConn(domain, userid);//移除已存在的
   if (conn!=null) {
        console.log('rejectConn domain:' + domain + '&userid:' + userid);
        var sendData = {
            fromId: 'server', //来源ID
            toId: userid, //接收对象 0广播,-1回发
            toDomain: domain,
            toGroupid: '',
            cmd: 'rejectConn', //命令
            data: 1//消息内容
        }
        conn.sendUTF(JSON.stringify(sendData));
    }
    return true;
}