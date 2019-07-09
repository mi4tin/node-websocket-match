//发送消息
var msgModel = {
	fromId: "", //来源ID
	toId: "", //接收对象 0广播
    msgId:"",//唯一标识
	msgType: "" ,//消息类型 0游戏邀请、2发送聊天消息
	msgInfo: ""//消息内容,根据消息类型自定义
}


//发送结果
var msgModel = {
    code: "",//-1未找到相关目标,0失败,1成功
    msg:""//说明
}

