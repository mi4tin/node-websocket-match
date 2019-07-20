//create time 2016��6��18��9:48:12
//author wsh
//��Ϣ����
//Ӧ�ó�������Ϣ���ͣ���Ϸ����
//���Ż���ÿ���û�

// ���ݸ�ʽ�� {
//    fromId: "", //��ԴID
//    toId: 0, //���ն��� 0�㲥---toId>0��toDomain����
//    toDomain: '',//�����򣬿�Ϊ����
//    toWaitMatch: '',//�Ƿ�Ϊ�ȴ�ƥ�䣬��Ϊ����
//    cmd: '', //����
//    data: "" //��Ϣ����
//   }

//---��־
const log4js = require('log4js');
log4js.configure({
    appenders: {
        info: {
            type: "dateFile",
            filename: 'info',
            pattern: "yyyyMMdd.log",
            alwaysIncludePattern: true//���Ϊtrue����ÿ���ļ����ᰴpattern�������������µ��ļ����ᰴ��pattern����
        },
        error: {
            type: "dateFile",
            filename: 'error',
            pattern: "yyyyMMdd.log",
            alwaysIncludePattern: true//���Ϊtrue����ÿ���ļ����ᰴpattern�������������µ��ļ����ᰴ��pattern����
        }
    },
    categories: {
        default: { appenders: ['info'], level: 'info' },//level��ʾ��͵ȼ�
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
//---��־ end

//--ȫ���쳣����
process.on('uncaughtException', function (err) {
    //��ӡ������
    logger.error(err);
});

var _tool = require('./tool.js');//����js�ļ�
//var db = require('./db.js');//����js�ļ�
var _WebSocketServer = require('websocket').server;
var _http = require('http');
var _heartbeat = 'heartbeat';

//��дconsole.log
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
    
    //��ȡ�û�������Ϣ
    var connection = request.accept(null, request.origin);
    var id = i;
    console.log('conn domain/userid:' + request.resource); 
    var resource = request.resource.split('/');
    var domain = resource[1];//������������Ϸ���(ͬһ����ÿ���û�ֻ�ܳ���һ��)
    var userid = resource[2];
    var groupid = resource.length >= 4 ? resource[3] : '';//��id:ʱ���+����������ʱ���+��(��֤����Ψһ)
    //�������ͻ��˻�������ƥ��������Ϣ���ݴ��ж������Ƿ����

    //�ظ���½����������ǰ��½
    isCanConn(domain, userid)

    var matchNum = resource.length >= 5 && !isNaN(resource[4]) ? Number(resource[4]) : 0;//Match��Ҫ����
    var waitMatch = matchNum > 1;

    var userObj = {
        conn: connection,
        id: id, domain: domain, groupid: groupid, userid: userid,
        waitMatch: waitMatch, matchNum: matchNum//�˴�matchNum��ʱδ��
    }
    //ƥ��ҵ��
    matchUsers(waitMatch, domain, groupid, userid);
    //�����û�
    _clients.push(userObj);
    i++;
    //֪ͨͬ��ͬ���Ա��������
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
                if (data.toId > 0) {//���Ӽ�������ִ��
                    sendClients = getClientsByCondition(data.toWaitMatch, data.toDomain, '', data.toId);
                }
                else if (data.toGroupid !=null&& data.toGroupid.length > 0) {//���鷢��
                    sendClients = getClientsByCondition(data.toWaitMatch, data.toDomain, data.toGroupid, '');
                }
                else if (data.toDomain!=null&&data.toDomain.length > 0) {//������
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

    //ƥ�䲢�����û�waitMatchֵ
    function matchUsers(waitMatch, domain, groupid, userid) {
        if (waitMatch) { //Ѱ�Һ���ƥ�����
            var matchList = getClientsByCondition(true, domain, groupid, '');
            if (matchList.length == 0 && groupid.length == 0) {
                groupid = userid; //��û�еȴ�ƥ��ʱ��ȡ��һ��Աuserid��Ϊgroupid�����������û�
            } else {
                if (groupid.length == 0) {
                    groupid = matchList[0].groupid; //��ȡgroupid������ΪС��groupid
                }
                if (matchList.length == matchNum - 1) {
                    //У������ matchNum>=2ʱ
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
                    //�޸ĳ�Ա״̬
                    for (var k = 0; k < matchNum - 1; k++) {
                        ma = matchList[k];
                        ma.waitMatch = false;
                    }
                    waitMatch = false; //���µ�ǰ�û�waitMatch=false
                }
                //֪ͨ��ǰ�û�ƥ�䵽���û�list
                noticeMatchedList(connection, matchList);

                //Ⱥ�������µ�ƥ���û�����
                noticeChangeMatch(matchList, domain, groupid, userid);
            }
        }
        userObj.groupid = groupid;
        userObj.waitMatch = waitMatch;
    }
});

//�Ƴ�����
function removeConn(domain,userid) {
    var client;
    var conn = null;
    for (var i in _clients) {
        client = _clients[i];
        if (client.domain == domain && client.userid == userid) {
            console.log('remove domain:' + client.domain + '&userid:' + userid);
            conn = client.conn;
            _clients.splice(i, 1);
            //֪ͨͬ��ͬ���Ա��������
            noticeOnlineNum(client.domain, client.groupid);

            if (client.matchNum > 0) {
                noticeChangeMatch(null, client.domain, client.groupid, client.userid*-1);//֪ͨƥ������
            }
            break;
        }
    }
    return conn;
}

//��ȡָ���û����ӡ�δ�á�
function getConnByUserid(domain,userid) {
    var clients = getClientsByCondition(null, domain, userid);
    if (clients.length > 0) {
        return clients[0].conn;
    } else {
        return null;
    }
}

//��ȡָ���û�
function getClientsByCondition(waitMatch, domain, groupid, userid) {
    if (!_tool.isNullOrEmpty(userid)) { //���Ӽ�������ִ��
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

//֪ͨ������������
function noticeOnlineNum(domain,  groupid) {
    var onlineNum = 0;
    if (groupid.length > 0) {//���Ӽ�������ִ�У�groupid���뱣֤ȫ��Ψһ��
        onlineNum = _clients.filter(function (x) {
            return x.groupid == groupid;
        }).length;
    } else {
        onlineNum = _clients.filter(function (x) {
            return x.domain == domain;
        }).length;
    }
    var sendData = {
        fromId: 'server', //��ԴID
        toId: -1, //���ն��� 0�㲥,-1������߼�����
        toDomain: domain,
        toGroupid: groupid,
        cmd: 'onlineNum', //����
        data: onlineNum//��Ϣ����
    }
    var sendClients = getClientsByCondition(null, domain, groupid);
    for (var i in sendClients) {
        sendClients[i].conn.sendUTF(JSON.stringify(sendData));
    }
}

var _matchCmd = "matchedList";//ƥ���û�
//ƥ���û�֪ͨ
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
        fromId: 'server', //��ԴID
        toId: -1, //���ն��� 0�㲥
        toDomain: domain,
        toGroupid: groupid,
        cmd: cmd, //����
        data: [matchUserid]//��Ϣ����   
    }
    for (var i in toList) {
        toList[i].conn.sendUTF(JSON.stringify(sendData));
    }
}

//֪ͨƥ�䵽���û�
function noticeMatchedList(toConn, matchedList) {
    if (matchedList.length == 0) {
        return;
    }
    var userids = [];
    for (var n = 0; n < matchedList.length; n++) {
        userids.push(matchedList[n].userid);
    }
    var sendData = {
        fromId: 'server', //��ԴID
        toId: -1, //���ն��� 0�㲥
        toDomain: '',
        toGroupid: '',
        cmd: _matchCmd, //����
        data: userids//��Ϣ����
    }
    toConn.sendUTF(JSON.stringify(sendData));
}

//ȷ���Ƿ��������ӣ����ѵ�½���Ƴ���ǰ���ӡ�������ǰ���ӷ���rejectConn����Ա�ʾ��ǰ��½������
function isCanConn(domain, userid) {
    var conn = removeConn(domain, userid);//�Ƴ��Ѵ��ڵ�
   if (conn!=null) {
        console.log('rejectConn domain:' + domain + '&userid:' + userid);
        var sendData = {
            fromId: 'server', //��ԴID
            toId: userid, //���ն��� 0�㲥,-1�ط�
            toDomain: domain,
            toGroupid: '',
            cmd: 'rejectConn', //����
            data: 1//��Ϣ����
        }
        conn.sendUTF(JSON.stringify(sendData));
    }
    return true;
}