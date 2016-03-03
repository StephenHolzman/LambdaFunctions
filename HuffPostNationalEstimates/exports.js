
var request = require('request');
var async = require('async');
var AWS = require('aws-sdk');
var json2csv = require('json2csv');

exports.handler = function(event, context){
    var requestUrls = [
        {
            "url":"http://elections.huffingtonpost.com/pollster/api/charts/2016-national-gop-primary.json",
            "keyname":"reps/EstimatesGOP",
            "choices":["Trump","Rubio","Cruz","Bush","Carson","Christie","Rand Paul","Fiorina","Kasich","Jindal"]
        },{
            "url":"http://elections.huffingtonpost.com/pollster/api/charts/2016-national-democratic-primary.json",
            "keyname":"dems/EstimatesDEM",
            "choices":["Sanders","Clinton"]
        }]

    var partiesdone = 0;

    var uploadS3 = function(uploadobject,keyname,choices){
        var s3 = new AWS.S3();
        var prepJSONforCSV = [];
        var fields = choices;
        fields.push("date");

        //Build JSON that works with json2csv
        uploadobject.estimates_by_date.forEach(function(d,i){
            //console.log(d);
            obj = new Object();
            obj.date = d.date;
            for(c in choices){
                for(value in d.estimates){
                    if(d.estimates[value].choice === choices[c]){
                        obj[choices[c]] = d.estimates[value].value;
                    }       
                }
                
            }
            prepJSONforCSV.push(obj);

        });

        //convert json to csv
        json2csv({ data: prepJSONforCSV, fields: fields }, function(err, csv) {

            if (err) console.log(err);

            //Upload csv to S3
            s3.createBucket({Bucket: 'HuffPoPollsterDump'}, function() {

                var params = {Bucket: 'HuffPoPollsterDump', Key: keyname, Body: csv}

                s3.putObject(params, function(err, data) {

                    if (err){
                        console.log(err);
                        context.fail();
                    }else{
                        console.log("Successfully uploaded data to S3!");
                        partiesdone++;
                        if(partiesdone===2){
                            context.succeed(); 
                        }       
                    }
                });
            });
        });
    };

    var req = async.forEach(requestUrls, function(item,callback){
        
        request({
            url: item.url,
            json: true
        }, function(error, response, body){
            uploadS3(body,item.keyname,item.choices);
        }, function(error){
            context.fail();
        })

    });

};


