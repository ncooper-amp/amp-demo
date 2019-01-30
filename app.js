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
var axios = require('axios')

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

const getAuthToken = function(){
  return new Promise(function(resolve, reject){
    axios({
      method:"post",
      url:"https://auth-qa3.adis.ws/oauth/token",
      headers:{
        "Content-Type":"application/x-www-form-urlencoded"
      },
      params:{
        username:userName,
        password:passWord,
        client_id:clientId,
        grant_type:"password",
      }
    })
    .then(response => {
      resolve(response.data.access_token);
      })
    .catch(error => {
      console.log(error);
      reject(error);
    })
  })
};

const getImgData = async function (graph) {
    let promises = [];
    for (var i = 0; i < graph.length; i++) {
        if (graph[i].mediaType == 'image') {
            let metadata = await axios.get("http://i1-qa.adis.ws/i/" + graph[i].endpoint + "/" + graph[i].name + ".json?metadata=true");
            graph[i].imgMetaData = metadata.data;
        }
    }
}

app.get('/',async function(req,res,next){
  let content = await axios.get("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  await getImgData(content.data['@graph']);
  var contentGraph = amp.inlineContent(content.data);
  var stringContent = JSON.stringify(contentGraph,null,'\t');
  res.render('homepage',{
    static_path:'/static',
    theme:process.env.THEME || 'flatly',
    pageTitle : "HomePage",
    pageDescription : "Homepage",
    query:req.query,
    content:contentGraph[0]
  })
})

app.get('/ListContentItems/:size/:page', function (req, res, next) {

      try{
        getAuthToken().then(authToken =>{
          axios({
            method:"get",
            url: "http://"+cmsEnvironment+"/cms-service/content-repositories/"+respositoryId+"/content-items?page="+req.params.page+"&size="+req.params.size,
            headers:{
              "Authorization": "Bearer " + authToken
            }
          })
            .then(response => {
              var contentGraph = response.data;
              stringContent = JSON.stringify(response.data,null,'\t');
              //console.log(response);
              res.render('list-content-items',{'title':'List Content Items - Success','contentGraph': contentGraph, 'stringContent' : stringContent, 'reqParams': req.query});
            })
            .catch(error => {
              console.log(error);
              res.render('list-content-items',{'title':'List Content Items - Fail','reqParams': req.query, 'error':error});
            });
        })
        .catch(error => {
          console.log(error)
        })

        }
      catch (e) {
        next(e)
      }


  /* res.render('list-content-items',{title:"List Content Items",error:"figure out how to authorize so that i can list the content items and create links.."}) */

})

app.get('/carousel',async function(req,res,next){
  let content = await axios.get("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  await getImgData(content.data['@graph']);
  var contentGraph = amp.inlineContent(content.data);
  var stringContent = JSON.stringify(contentGraph,null,'\t');
  res.render('carousel',{
    static_path:'/static',
    theme:process.env.THEME || 'flatly',
    pageTitle : "HomePage",
    pageDescription : "Homepage",
    query:req.query,
    content:contentGraph[0]
  })
})



app.get('/panels',async function(req,res,next){
  let content = await axios.get("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  await getImgData(content.data['@graph']);
  var contentGraph = amp.inlineContent(content.data);
  var stringContent = JSON.stringify(contentGraph,null,'\t');
  res.render('panels',{
    static_path:'/static',
    theme:process.env.THEME || 'flatly',
    pageTitle : "HomePage",
    pageDescription : "Homepage",
    query:req.query,
    content:contentGraph[0]
  })
})

app.get('/showJSON', async function(req,res,next){
  let content = await axios.get("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  await getImgData(content.data['@graph']);
  var contentGraph = amp.inlineContent(content.data);
  var stringContent = JSON.stringify(contentGraph,null,'\t');
  res.render('showJSON',{
    static_path:'/static',
    theme:process.env.THEME || 'flatly',
    pageTitle : "HomePage",
    pageDescription : "Homepage",
    stringContent:stringContent,
    query:req.query
  })
})
