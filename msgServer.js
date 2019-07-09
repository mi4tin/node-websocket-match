//create time 2016年6月18日9:48:12
//author wsh
//消息服务
//应用场景：消息发送，游戏邀请

var tool = require('./tool.js');//加载js文件
var db = require('./db.js');//加载js文件
var WebSocketServer = require('websocket').server;
var http = require('http');
var inviteMsg = [];

//重写console.log
console.log = (function (oriLogFunc) {
    return function (str) {
        oriLogFunc.call(console, str, tool.getFullNowTime());
    }
})(console.log);

var server = http.createServer(function(request, response) {
});
server.listen(1450, function() { });

// create the server
wsServer = new WebSocketServer({
    httpServer: server
});

// store all connected clients
var clients = [];//{ conn: connection, id: id,domain:domain,userid:userid }
var i = 0;

wsServer.on('request', function(request) {
    
    var connection = request.accept(null, request.origin);
    console.dir(request.resource);
    var id = i;
    console.log("Connected-id:" + id);
    clients.push({ conn: connection, id: id });
    i++;

    //回发服务连接信息
   var backData = {
        fromId: id, //来源ID
        toId: id, //接收对象 0广播
        msgId: 0,
        msgType: 'connback', //消息类型 0游戏邀请、2发送聊天消息、connback连接回发
        msgInfo: id //消息内容
    }
    sendData(connection, backData, JSON.stringify(backData), 0);
    // Simply pass any received messages onto all other clients
    connection.on('message', function (message) {
        console.dir(message);
	    if (message.type === 'utf8') {
            var datastr = message.utf8Data;
            if (tool.isNullOrEmpty(datastr)) {
                return;
            } else {
                console.log(datastr);
                var data = JSON.parse(datastr);
                switch(data.msgType ) {
                    case 0:// 游戏邀请
                        var outMsecs = new Date().getTime() + 2 * 60 * 1000;
                        timeOutSend(connection, data, datastr, outMsecs, 25, 0);
                        break;
                    case 1:// 发送聊天消息
                        break;
                    case 'sendSite':// 发送聊天消息
                        sendData(connection, data, datastr, 0);
                        break;
                }
            }
        }
    });

    connection.on('close', function (connection) {
        console.log('close');
	    console.log(connection);
        removeConn(id);
    });
});
//outMsec超时毫秒数，splitSec多少秒发送一次
function timeOutSend(conn, data, dataStr, outMsec, splitSec, stId) {
   stId = sendData(conn, data, dataStr, stId);
   console.log('========');
   if (data.toId == 0) {
       if (new Date().getTime() < outMsec) {
           setTimeout(function() {
               timeOutSend(conn, data, dataStr, outMsec, splitSec, stId);
           }, splitSec * 1000); //25秒发送一次
       } else {
           console.log('over');
       }
   }
}

function sendData(conn, data,dataStr,stId) {
    var toClient;
    console.log('send stid:'+stId);
    if (data.toId == 0 && data.msgType == 0) {
        //发送给所有
        var goClients = clients.filter(function (c) { return c.id >= stId; });
        if (goClients.length > 0) {
            for (var j in goClients) {
                toClient = goClients[j];
                console.log('send id:' + toClient.id);
                toClient.conn.sendUTF(dataStr);
                stId = toClient.id;
            }
            stId += 1;
        }
    } else {
        //发送给指定用户
        toClient = getConn(data.toId);
        if (toClient == null) {
            conn.sendUTF(JSON.stringify({ code: -1, msg: "no find goal" }));
        } else {
            console.log('send id1:' + data.toId);
            toClient.sendUTF(dataStr);
            conn.sendUTF(JSON.stringify({ msgType: data.msgType, code: 1 }));
            return;
        }
    }
    conn.sendUTF(JSON.stringify({code: 1 }));
    console.log('re:' + stId);
    return stId;
}

function removeConn(id) {
    console.log('removeid:' + id);
    var client;
    for (var i in clients) {
        client = clients[i];
        if (client.id == id) {
            clients.splice(i, 1);
            break;
        }
    }
}

function getConn(id) {
    var client;
    for (var i in clients) {
        client = clients[i];
        if (client.id == id) {
            return client.conn;
        }
    }
    return null;
}


//===bll===

