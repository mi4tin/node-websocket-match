//create time 2016-6-19 16:17:44
//author wsh
//websocket tool

//得到当前时间
exports.getNowTime = function () {
    var d = new Date();
    var vYear = d.getFullYear();
    var vMon = d.getMonth() + 1;
    var vDay = d.getDate();
    return vYear + '-' + vMon + '-' + vDay;
}

exports.getFullNowTime = function () {
    var date = new Date();
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    var hour = date.getHours();
    var minute = date.getMinutes();
    var second = date.getSeconds();
    return year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second;
}

//是否为空或null
exports.isNullOrEmpty = function (obj) {
    if (obj == null || obj.length == 0) {
        return true;
    } else {
        return false;
    }
}

//解码url
function deUrlNew(uriComponent) {
    if (!uriComponent) {
        return uriComponent;
    }
    var ret;
    try {
        ret = decodeURIComponent(uriComponent);
    } catch (ex) {
        ret = unescape(uriComponent);
    }
    return ret;
}

//验证手机号
function checkMobile(str) {
    var re = /^1\d{10}$/;
    if (re.test(str)) {
        return true;
    } else {
        return false;
    }
}

//得到字符串字节长度
function getByteLength(str) {
    if (isNullOrEmpty(str)) {
        return 0;
    }
    return str.replace(/[^\x00-\xff]/g, "aa").length;
}

//判断某个值是否包含在数组里
 function arrayContain(v, isIndexOf) {
    var array = this;
    if (array == null) {
        return false;
    }
    return array.filter(function(a) {
        return isIndexOf ? a.indexOf(v) != -1 : a == v;
    }).length > 0;
}

//去掉所有的html标记
function delHtmlTag(str) {
    return str.replace(/<[^>]+>/g, "").replace(/\s/g, '');
}

//得到任意值之间随机数,包含起止值
function getRan(lowValue, highValue) {
    var choice = highValue - lowValue + 1;
    return Math.floor(Math.random() * choice + lowValue);
}
