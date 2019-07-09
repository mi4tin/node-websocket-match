//create time 2016��6��18��9:48:12
//author wsh
//��Ϣ����
//Ӧ�ó�������Ϣ���ͣ���Ϸ����

var tool = require('./tool.js');//����js�ļ�
var db = require('./db.js');//����js�ļ�
var WebSocketServer = require('websocket').server;
var http = require('http');
var inviteMsg = [];

//��дconsole.log
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

    //�ط�����������Ϣ
   var backData = {
        fromId: id, //��ԴID
        toId: id, //���ն��� 0�㲥
        msgId: 0,
        msgType: 'connback', //��Ϣ���� 0��Ϸ���롢2����������Ϣ��connback���ӻط�
        msgInfo: id //��Ϣ����
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
                    case 0:// ��Ϸ����
                        var outMsecs = new Date().getTime() + 2 * 60 * 1000;
                        timeOutSend(connection, data, datastr, outMsecs, 25, 0);
                        break;
                    case 1:// ����������Ϣ
                        break;
                    case 'sendSite':// ����������Ϣ
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
//outMsec��ʱ��������splitSec�����뷢��һ��
function timeOutSend(conn, data, dataStr, outMsec, splitSec, stId) {
   stId = sendData(conn, data, dataStr, stId);
   console.log('========');
   if (data.toId == 0) {
       if (new Date().getTime() < outMsec) {
           setTimeout(function() {
               timeOutSend(conn, data, dataStr, outMsec, splitSec, stId);
           }, splitSec * 1000); //25�뷢��һ��
       } else {
           console.log('over');
       }
   }
}

function sendData(conn, data,dataStr,stId) {
    var toClient;
    console.log('send stid:'+stId);
    if (data.toId == 0 && data.msgType == 0) {
        //���͸�����
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
        //���͸�ָ���û�
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

