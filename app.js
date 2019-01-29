var AWS = require('aws-sdk');
var express = require('express');
var amp = require('cms-javascript-sdk');
var router = express.Router();
var bodyParser = require('body-parser');
var expressValidator = require('express-validator');
var path = require('path');
var request = require('request');
var hbs = require('handlebars');
var expressHbs = require('express-handlebars');
var helpers = require('handlebars-helpers')(['array', 'object', 'comparison','regex']);

var app = express();
app.use('/static', express.static(path.join(__dirname,'/static')));
app.use('/scripts', express.static(__dirname + '/node_modules/'));

app.set('view engine', 'hbs')
app.engine('hbs', expressHbs( {
  extname: 'hbs',
  layoutsDir: __dirname + '/views/',
  partialsDir: __dirname + '/views/partials/',
  helpers
} ) );
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:false}));
app.use(expressValidator());
app.set('node_modules', __dirname + '/node_modules');
app.set('models', __dirname + '/models');
var port = process.env.PORT || 3000;

var server = app.listen(port, function() {
  console.log('Server running at http://127.0.0.1:' + port + '/')
})

var vseEnvironment = process.env.VSE_ENV
var respositoryId = process.env.REPO_ID
var cmsEnvironment = process.env.CMS_PROD
var cmsEnvironmentUAT = process.env.CMS_UAT
var userName = process.env.USERNAME
var passWord = process.env.PASSWORD
var clientId = process.env.CLIENT
var apiKey = process.env.KEY
var apiSecret = process.env.SECRET
var endPoint = process.env.ENDPOINT

const getImgData = function (cGraphNode) {
    let promises = [];
    for (i in cGraphNode) {
        console.log("i:")
        console.log(i);
        console.log("typeof(cGraphNode[i]):");
        console.log(typeof (cGraphNode[i]))
        console.log("cGraphNode[i]:")
        console.log(cGraphNode[i])
        //console.log(cGraphNode[i])
        if (i == 'image') {
            //console.log("http://i1-qa.adis.ws/i/"+cGraphNode[i].endpoint+"/"+cGraphNode[i].name+".json?metadata=true")
            var options = {
                method: 'GET',
                url: "http://i1-qa.adis.ws/i/" + cGraphNode[i].endpoint + "/" + cGraphNode[i].name + ".json?metadata=true"
            }
            var myPromise = new Promise(function (resolve, reject) {
                request(options, function (err, response, body) {
                    if (err) {
                        reject(err);
                    } else {
                        cGraphNode[i].imgMetaData = body;
                        console.log(body)
                        resolve(cGraphNode);
                    }
                })
            });
            promises.push(myPromise);

        }
    }
    return Promise.all(promises);
}

app.get('/',function(req,res,next){
  var options = {
    method:'GET',
    url:"http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store
  };
  request(options,function(err,response,body){
    // console.log(response);
    // console.log(options);
    if(err){
      res.render('homepage',{
        static_path:'/static',
        theme:process.env.THEME || 'flatly',
        pageTitle : "HomePage",
        pageDescription : "Homepage",
        content:err,
        query:req.query
      })
    }
    else {
      let content = JSON.parse(body);
      let contentWithMeta = getImgData(content);
      var contentGraph = amp.inlineContent(contentWithMeta);
      console.log(contentGraph)
      var stringContent = JSON.stringify(contentGraph,null,'\t');
      res.render('homepage',{
          static_path:'/static',
          theme:process.env.THEME || 'flatly',
          pageTitle : "HomePage",
          pageDescription : "Homepage",
          content:contentGraph[0],
          stringContent:stringContent,
          query:req.query
      })
    }
  })

})

app.get('/showJSON',function(req,res,next){
  var options = {
    method:'GET',
    url:"http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store
  };
  request(options,function(err,response,body){
    if(err){
      res.render('showJSON',{
        static_path:'/static',
        theme:process.env.THEME || 'flatly',
        pageTitle : "HomePage",
        pageDescription : "Homepage",
        content:err,
        query:req.query
      })
    }
    else {
      //var contentGraph = amp.inlineContent(JSON.parse(body));
      //console.log(contentGraph);
      //var stringContent = JSON.stringify(contentGraph,null,'\t');
      let content = JSON.parse(body);
      let contentWithMeta = getImgData(content);
      var contentGraph = amp.inlineContent(contentWithMeta);
      console.log(contentGraph)
      var stringContent = JSON.stringify(contentGraph,null,'\t');
      res.render('showJSON',{
        static_path:'/static',
        theme:process.env.THEME || 'flatly',
        pageTitle : "HomePage",
        pageDescription : "Homepage",
        stringContent:stringContent,
        query:req.query
      })
    }

  })

})
