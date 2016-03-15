//Load necessary javascript libraries
var request = require('request');
var async = require('async');
var AWS = require('aws-sdk');
var json2csv = require('json2csv');

/* The handler function is the main function wrapper.
 * Event is an object passed to the function by Lambda when it is called.
 * Because this is scheduled, it is not dependent on any of the event properties.
 * Context is an object passed by Lambda that contains methods for terminating the function when done.
 */

exports.handler = function(event, context){

    /* URL is the API call
     * Keyname is the filename
     * Choices are party candidates I'm interested in.
     */

    var requestUrls = [
        {
            "url":"http://elections.huffingtonpost.com/pollster/api/charts/2016-national-gop-primary.json",
            "keyname":"election/data/gop_national_estimates.csv",
            "choices":["Trump","Cruz","Rubio","Kasich","Carson","Bush","Christie","Rand Paul","Fiorina","Jindal"]
        },
        {
            "url":"http://elections.huffingtonpost.com/pollster/api/charts/2016-national-democratic-primary.json",
            "keyname":"election/data/dem_national_estimates.csv",
            "choices":["Clinton","Sanders"]
        };
    ];

    /* Define function that uploads cleaned CSV to S3 that will be called later in request callback
     * Uploadobject is the body returned by the API request
     * Keyname is the keyname property from the requestUrls item.
     * Choices is the choices property from the requestUrls item.
     */

    var uploadS3 = function(uploadobject,keyname,choices){


        var s3 = new AWS.S3();
        var prepJSONforCSV = [];

        /* Build JSON that works with json2csv from uploadobject
         */

        uploadobject.estimates_by_date.forEach(function(d,i){

            obj = new Object();
            obj.date = d.date;
            for(c in choices){
                for(value in d.estimates){
                    if(d.estimates[value].choice === choices[c]){
                        obj[choices[c]] = d.estimates[value].value;
                    };       
                };             
            };
            prepJSONforCSV.push(obj);

        });

        /* Convert json to csv
         * Fields are csv headers
         */

        var fields = choices;
        fields.push("date");

        json2csv({ data: prepJSONforCSV, fields: fields }, function(err, csv) {

            if (err) console.log(err);

            /* AWS access.
             * Credentials are taken care of by Lambda.
             * Creates a bucket for files if it doesn't exist.
             * uploads object with keyname as filename.
             */

            s3.createBucket({Bucket: 'chartsoncharts.com'}, function() {

                var params = {Bucket: 'chartsoncharts.com', Key: keyname, Body: csv}

                s3.putObject(params, function(err, data) {

                    if (err){
                        console.log(err);
                        //If there's an error, context fail let's Lambda know you failed and ends the function.
                        context.fail();
                    }else{
                        console.log("Successfully uploaded data to S3!");
                        partiesdone++;
                        if(partiesdone===2){
                            //If the expected number of objects have been uploaded, context succeed let's Lambda know you succeeded and ends the function.
                            context.succeed(); 
                        }       
                    }
                });
            });

        });

    };
    /*Actually run the code.
     *I chose to put context.succeed() in putObject function, but could just as easily be in the async.foreach callback here.
     */
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



