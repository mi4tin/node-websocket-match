


//mssql--global
var mssql = require('mssql');

var config = {
    user: 'sa',
    password: 'sa',
    server: 'localhost\\mss1', // You can use 'localhost\\instance' to connect to named instance
    database: 'VS',

    options: {
        encrypt: true // Use this if you're on Windows Azure
    }
}

sqlQuery("update Users set RealName='回去1' where userid=1");

function sqlQuery(sqlStr)
{
    mssql.connect(config, function (err) {
        // ... error checks

        // Query

        var request = new mssql.Request();
        request.query(sqlStr, function (err, recordset) {
            // ... error checks

            console.log(recordset);
        });

        // Stored Procedure

        //var request = new mssql.Request();
        //request.input('input_parameter', mssql.Int, value);
        //request.output('output_parameter', mssql.VarChar(50));
        //request.execute('procedure_name', function (err, recordsets, returnValue) {
        //    // ... error checks

        //    console.dir(recordsets);
        //});


    });
}




