var AWS = require('aws-sdk');
var express = require('express');
var fs = require('fs');
var https = require('https')
var http = require('http')
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
var formidable = require('formidable')
var glmatrix = require('gl-matrix')
const querystring = require('querystring');
var xhub = require('express-x-hub');
var jp = require('jsonpath');
const { promises } = require('dns');
const { json } = require('body-parser');
const { resolve } = require('path');
require('dotenv').config()

var app = express();
app.use('/static', express.static(path.join(__dirname,'/static')));
app.use('/scripts', express.static(__dirname + '/node_modules/'));

app.set('view engine', 'hbs')
app.engine('hbs', expressHbs.engine( {
  extname: 'hbs',
  layoutsDir: __dirname + '/views/',
  partialsDir: __dirname + '/views/partials/',
  helpers
} ) );

app.use(xhub({ algorithm: 'sha1', secret: process.env.APP_SECRET }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:false}));
app.use(expressValidator());
app.set('node_modules', __dirname + '/node_modules');
app.set('models', __dirname + '/models');
app.use((req,res,next) => {
  res.append("Accept-CH","DPR, Width, Viewport-Width, RTT, ECT, Downlink");
  res.append("Vary","DPR, Width, Viewport-Width, RTT, ECT, Downlink");
  // res.append("Feature-Policy","ch-dpr http://sjyqzbody3qw1lq6zeetg5clj.staging.bigcontent.io; ch-width http://sjyqzbody3qw1lq6zeetg5clj.staging.bigcontent.io; ch-viewport-width http://sjyqzbody3qw1lq6zeetg5clj.staging.bigcontent.io;");
  next();
})

/*

yes, port 80 and 443 would be better, but they're blocked for localhost so these two will have to do...

*/
var port = process.env.PORT || 3000;
var securePort = process.env.SECURE_PORT || 3001;


/*

http://webcache.googleusercontent.com/search?q=cache:https://docs.nodejitsu.com/articles/HTTP/servers/how-to-create-a-HTTPS-server

create self-signed certs by doing these in the terminal - within the folder where app.js is

openssl genrsa -out key.pem
openssl req -new -key key.pem -out csr.pem
openssl x509 -req -days 9999 -in csr.pem -signkey key.pem -out cert.pem
rm csr.pem

*/
/*
var options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

var sectureServer = https.createServer(options,app).listen(securePort, function() {
  console.log('Server running at http://127.0.0.1:' + securePort + '/')
})
*/

var server = http.createServer(app).listen(port, function() {
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
var imgSrc = process.env.IMGSRC
var token = process.env.TOKEN || 'token';
var received_updates = [];

var tokenExpires = 0

const getAuthToken = async function(whichEnv,currentToken){
  
    return new Promise(function(resolve, reject){
      if (tokenExpires - Date.now() < 500){
        console.log("got here");
        if (whichEnv == 'qa'){
          var authCall = {
            method:"post",
            url:"https://auth.amplience-qa.net/oauth/token",
            params:{
              client_id:process.env.QA_CLIENT,
              username:process.env.QA_USERNAME,
              password:process.env.QA_PASSWORD,
              grant_type:"password",
            }
          }
        }
        else if (whichEnv == 'password' ) {
          var authCall = {
            method:"post",
            url:"https://auth.amplience.net/oauth/token",
            params:{
              client_id:process.env.PROD_PASSWORD_CLIENT,
              username:process.env.PROD_PASSWORD_USERNAME,
              password:process.env.PROD_PASSWORD_PASSWORD,
              grant_type:"password",
            }
          }
        }  
        else {
          var authCall = {
            method:"post",
            url:"https://auth.amplience.net/oauth/token",
            params:{
              client_id:clientId,
              client_secret:apiSecret,
              grant_type:"client_credentials",
            }
          }
        }  
        //onsole.log(authCall);
        axios(authCall)
        .then(response => {
          console.log("created new token before previous expired");
          tokenExpires = Date.now() + (response.data.expires_in * 1000);
          resolve(response.data.access_token);
          })
        .catch(error => {
          console.log(error);
          reject(error);
        })
    }
    else {
      console.log("reused existing token")
      resolve(currentToken);
    }
  })
};


const getHubs = async(whichEnv,authToken,s=100,n=0) => {
  var allHubData = []
  var totalElements = 0;
  var keepgoing = true;
  while (keepgoing){
   console.log("https://api.amplience.net/v2/content/hubs?size=" + s + "&page=" + n)
   let response = await axios({
      method: "get",
      url: "https://api.amplience.net/v2/content/hubs?size=" + s + "&page=" + n,
      headers: {
        "Authorization": "Bearer " + authToken
      }
    })
    await allHubData.push.apply(allHubData,response.data['_embedded'].hubs);
    totalElements += response.data.page.size;
    n++;
    if (totalElements >= response.data.page.totalElements){
      keepgoing = false;
      let filteredHubData = []
      for (const hub of allHubData){
        filteredHubData.push([hub.id,hub.label,hub.settings.publishing.platforms.amplience_dam.endpoint])
      }
      if (filteredHubData.length == allHubData.length){
        return filteredHubData
      }
    }

  }
  
}

const getRepos = async(whichEnv,hubId,authToken,s=100,n=0) => {
  var allRepoData = []
  var totalElements = 0;
  var keepgoing = true;
  while (keepgoing){
   authToken = await getAuthToken(whichEnv,authToken)
   console.log("https://api.amplience.net/v2/content/hubs/"+hubId+"/content-repositories?size=" + s + "&page=" + n)
   let response = await axios({
      method: "get",
      url: "https://api.amplience.net/v2/content/hubs/"+hubId+"/content-repositories?size=" + s + "&page=" + n,
      headers: {
        "Authorization": "Bearer " + authToken
      }
    })
    await allRepoData.push.apply(allRepoData,response.data['_embedded']['content-repositories']);
    totalElements += response.data.page.size;
    n++;
    if (totalElements >= response.data.page.totalElements){
      keepgoing = false;
      let filteredRepoData = []
      for (const repo of allRepoData){
        filteredRepoData.push([repo.id,repo.label,repo.name])
      }
      if (filteredRepoData.length == allRepoData.length){
        return filteredRepoData
      }
    }

  }
  
}

const getContentItems = async(whichEnv,repos,authToken) => {
  var allContentItemData = []
  var totalElements = 0;
  var currentLoopIndex = 0;
  console.log(repos.length)
  for (const [index,repo] of repos.entries()){
    console.log("repo:"+ repo);
    console.log(index);
    currentLoopIndex++;
    var s=100;
    var n=0;
    var keepgoing = true;
    while (keepgoing){
     authToken = await getAuthToken(whichEnv,authToken)
     console.log("https://api.amplience.net/v2/content/content-repositories/"+repo[0]+"/content-items?size=" + s + "&page=" + n)
     let response = await axios({
        method: "get",
        url: "https://api.amplience.net/v2/content/content-repositories/"+repo[0]+"/content-items?size=" + s + "&page=" + n,
        headers: {
          "Authorization": "Bearer " + authToken
        }
      })
      // console.log(response.data['_embedded']['content-items']);
      await allContentItemData.push.apply(allContentItemData,response.data['_embedded']['content-items']);
      totalElements += response.data.page.size;
      n++;
      if (totalElements >= response.data.page.totalElements){
        keepgoing = false;
        
      }
  
    }
  }
  if (currentLoopIndex == repos.length){
    let filteredContentItemData = []
    for (const item of allContentItemData){
      console.log(item.id);

      filteredContentItemData.push({"RepoId":item.contentRepositoryId,"ItemId":item.id,"Label":item.label,"Author":item.createdBy})
      console.log(filteredContentItemData);
    }
    console.log("filteredContentItemData:"+filteredContentItemData.length+"allContentItemData:"+allContentItemData.length)
    if (filteredContentItemData.length >= allContentItemData.length){
      console.log("got here");
      return filteredContentItemData
    }
  }
}

/*
const amqplib = require('amqplib');

var q = 'tasks';

var url = process.env.CLOUDAMQP_URL;
var open = require('amqplib').connect(url);

// Consumer
open.then(function(conn) {
  var ok = conn.createChannel();
  ok = ok.then(function(ch) {
    ch.assertQueue(q);
    ch.consume(q, function(msg) {
      if (msg !== null) {
        console.log(msg.content.toString());
        ch.ack(msg);
      }
    });
  });
  return ok;
}).then(null, console.warn);

// Publisher




app.get('/webhookListener', function(req, res) {
  // console.log(req);
  res.send('<pre>' + JSON.stringify(received_updates, null, 2) + '</pre>');
});

app.get(['/facebook', '/instagram'], function(req, res) {
  if (
    req.query['hub.mode'] == 'subscribe' &&
    req.query['hub.verify_token'] == token
  ) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

app.post('/facebook', function(req, res) {
  console.log('Facebook request body:', req.body);

  if (!req.isXHubValid()) {
    console.log('Warning - request header X-Hub-Signature not present or invalid');
    res.sendStatus(401);
    return;
  }

  console.log('request header X-Hub-Signature validated');
  // Process the Facebook updates here
  open.then(function(conn) {
    var ok = conn.createChannel();
    ok = ok.then(function(ch) {
      ch.assertQueue(q);
      ch.sendToQueue(q, new Buffer(req.body));
    });
    return ok;
  }).then(null, console.warn);
  res.sendStatus(200);
});

app.post('/instagram', function(req, res) {
  console.log('Instagram request body:');
  console.log(req.body);
  // Process the Instagram updates here
  open.then(function(conn) {
    var ok = conn.createChannel();
    ok = ok.then(function(ch) {
      ch.assertQueue(q);
      ch.sendToQueue(q, new Buffer(req.body.field + ',' + (req.body.value.media_id||0) + ',' + (req.body.value.comment_id||0)));
    });
    return ok;
  }).then(null, console.warn);
  res.sendStatus(200);
});
*/
app.get('/permsReport',function(req,res,next){
  try{
    getAuthToken("qa",{})
      .then(authToken =>{
        axios({
          method:"get",
          url:"https://auth.amplience-qa.net/groups",
          headers:{
            "Authorization": "Bearer " + authToken
          }
        })
        .then(response => {
          stringContent = JSON.stringify(response.data,null,'\t');
          var userDetails = jp.query(response.data,'$.included..attributes')
          var userIds = jp.query(response.data,'$.included..id')
          var groupIds = jp.query(response.data,'$.data.*.id')
          var groupLabels = jp.query(response.data,'$.data..attributes.label')
          var groupMembers = jp.query(response.data,'$..data..relationships.member.data')
          var userInfo = []
          for (x in userIds){
            var entry = {}
            entry[userIds[x]] = userDetails[x]
            userInfo.push(entry)
          }
          var groupInfo = [];
          for (y in groupIds){ 
            var groupEntry = {}
            groupEntry[groupIds[y]] = {};
            groupEntry[groupIds[y]].label = groupLabels[y]
            //console.log('$.data[?(@.id==\''+groupIds[y]+'\')].relationships.member.data.*.id');
            memberIdsArray = jp.query(response.data,'$.data[?(@.id==\''+groupIds[y]+'\')].relationships.member.data.*.id')
            //memberIdsString = memberIdsArray.toString();
            groupEntry[groupIds[y]].memberIds = memberIdsArray
            groupInfo.push(groupEntry)
          }
          
          for (z in userInfo){
            var usersGroups = [];
            for (a in groupInfo){
              var currUserId = Object.keys(userInfo[z]);
              currUserId = currUserId.toString();
              var currGroupId = Object.keys(groupInfo[a])
              var currGroupName = Object.keys(groupInfo[a])
              currGroupId = currGroupId.toString();
              var currgroupMembers = groupInfo[a][currGroupId].memberIds
              if (currgroupMembers.includes(currUserId)){
                usersGroups.push(groupInfo[a][currGroupName].label);
              }
            }
            userInfo[z][currUserId].groups = usersGroups;
          }
          console.log(userInfo);
          axios({
            method:"get",
            url:"https://api.amplience-qa.net/v2/content/hubs",
            headers:{
              "Authorization": "Bearer " + authToken
            }
          })
          .then(hubsresponse => {
            // console.log(hubsresponse);
            var hubIds = jp.query(hubsresponse.data,'$..*.*.id')
            var hublabels = jp.query(hubsresponse.data,'$..*.*.label')
            var hubdescriptions = jp.query(hubsresponse.data,'$..*.*.description')
            var hubInfo = {};
            var promises = [];
            var memberObj = {};
            console.log(hubIds)
            for (h in hubIds){
              promises.push(axios({
                method:"get",
                url:"https://api.amplience-qa.net/v2/content/admin/access/hubs/"+ hubIds[h] +"/members",
                headers:{
                  "Authorization": "Bearer " + authToken
                }
              })
                .then(members => {
                  var hubMemberIds = jp.query(members.data['_embedded'].members,'$..sid')
                  var hubMemberperms = jp.query(members.data['_embedded'].members,'$..permissions')
                  memberObj[hubIds[h]] = {
                    "id":hubMemberIds,
                    "permissions":hubMemberperms
                  }
                })
                .catch(error => {
                  console.error(error);
                  res.sendStatus(500);
                }))
            }
            //console.log(gethubMembers);
              Promise.all(promises)
              .then(promiseResponse => {
                //console.log("get members response")
                console.log(memberObj)
                
              })
              .catch(error => {
                console.error(error);
                res.sendStatus(500);
              });
            
            //console.log(hubInfo)
            res.send(200);
          })
          .catch(error => {
            console.error(error);
            res.sendStatus(500);
          });
          
        })
        .catch(error => {
          console.error(error);
          res.sendStatus(500);
        });
      })
      .catch(error => {
        console.log(error)
      })
  }
  catch (e) {
    next(e)
  }
});

app.get('/ListContentItems/:size/:page', function (req, res, next) {

  try{
    getAuthToken().then(authToken =>{
      axios({
        method:"get",
        url: "https://"+cmsEnvironment+"/content-repositories/"+respositoryId+"/content-items?page="+req.params.page+"&size="+req.params.size,
        headers:{
          "Authorization": "Bearer " + authToken
        }
      })
        .then(response => {
          var contentGraph = response.data;
          stringContent = JSON.stringify(response.data,null,'\t');
          console.log(stringContent);
          res.render('list-content-items',{'pageTitle':'List Content Items - Success','contentGraph': contentGraph, 'stringContent' : stringContent, 'reqParams': req.query});
        })
        .catch(error => {
          console.log(error);
          res.render('list-content-items',{'pageTitle':'List Content Items - Fail','reqParams': req.query, 'error':error});
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


app.get('/retrieveImage/*', function(req,res,next){
  console.log(req);
  let queryString = querystring.unescape(querystring.stringify(req.query)).replace("$=","$");
  // console.log(queryString)
  var image = "http://cdn.media.amplience.net/i/"+ endPoint +"/" + req.params[0] + "?" + queryString + "&w=" + req.headers.width;
      // console.log(req.query)
      console.log(image); // captures correctly the image name
      req.pipe(request(image)).pipe(res)
})

app.get('/padDetecedObject/*', async function(req,res,next){
  // console.log(req);
  let metadata = await axios.get("http://cdn.media.amplience.net/i/"+ endPoint +"/" + req.params[0] + ".json?metadata=true");
  console.log(JSON.stringify(metadata.data.metadata));
  var boundingboxes = jp.query(metadata.data.metadata,'$.detectedObjects.data[?(@.instances != null)]..boundingBox');
  console.log(JSON.stringify(boundingboxes));
  let queryString = querystring.unescape(querystring.stringify(req.query)).replace("$=","$");
  // console.log(queryString)
  var image = "http://cdn.media.amplience.net/i/"+ endPoint +"/" + req.params[0] + "?" + queryString + "&w=" + req.headers.width;
      // console.log(req.query)
      console.log(image); // captures correctly the image name
      req.pipe(request(image)).pipe(res)
})

app.get('/retrieveImagePOI/:name', function(req,res,next){
  console.log(req.headers);
  var image = "http://cdn.media.amplience.net/i/"+ endPoint +"/" + req.params.name + "?$poi$&w="+  + req.headers.width +"&sm=aspect&aspect=1:1";
      console.log(image); // captures correctly the image name
      req.pipe(request(image)).pipe(res)
})

const getImgData = async function (graph) {
    // let promises = [];
    for (var i = 0; i < graph.length; i++) {
        if (graph[i].mediaType == 'image') {
            let metadata = await axios.get("http://"+imgSrc+"/i/" + graph[i].endpoint + "/" + graph[i].name + ".json?metadata=true");
            graph[i].imgMetaData = metadata.data;
        }
    }
}

app.get('/',async function(req,res,next){
  vseEnvironment = req.query.vse || process.env.VSE_ENV
  console.log("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  let content = await axios.get("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  //await getImgData(content.data['@graph']);
  var contentGraph = amp.inlineContent(content.data);
  //console.log(contentGraph[0]['@type'])
  var stringContent = JSON.stringify(contentGraph,null,'\t');
  console.log(stringContent);
  // console.log("viewport-width: " + req.headers['viewport-width'] + "\n")
  // console.log(req);
  res.render('homepage',{
    static_path:'/static',
    theme:process.env.THEME || 'flatly',
    pageTitle : "HomePage",
    pageDescription : "Homepage",
    query:req.query,
    content:contentGraph[0],
    viewport:req.headers['viewport-width']
  })
})



app.get('/svgcard',async function(req,res,next){
  vseEnvironment = req.query.vse || process.env.VSE_ENV
  console.log("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  let content = await axios.get("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  //await getImgData(content.data['@graph']);
  var contentGraph = amp.inlineContent(content.data);
  //console.log(contentGraph[0]['@type'])
  var stringContent = JSON.stringify(contentGraph,null,'\t');
  console.log(stringContent);
  // console.log("viewport-width: " + req.headers['viewport-width'] + "\n")
  // console.log(req);
  res.render('cards',{
    static_path:'/static',
    theme:process.env.THEME || 'flatly',
    pageTitle : "cardview",
    pageDescription : "cardview",
    query:req.query,
    content:contentGraph[0],
    viewport:req.headers['viewport-width']
  })
})

app.get('/autoformat',async function(req,res){
  vseEnvironment = req.query.vse || process.env.VSE_ENV
  console.log("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  let content = await axios.get("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  await getImgData(content.data['@graph']);
  var contentGraph = amp.inlineContent(content.data);
  // var stringContent = JSON.stringify(contentGraph,null,'\t');
  console.log("viewport-width: " + req.headers['viewport-width'] + "\n")
  // console.log(req);
  res.render('autoformat',{
    static_path:'/static',
    theme:process.env.THEME || 'flatly',
    pageTitle : "HomePage",
    pageDescription : "Homepage",
    query:req.query,
    content:contentGraph[0],
    viewport:req.headers['viewport-width']
  })
})

app.get('/afTester/*', function(req,res,next){
  console.log(req);
  let queryString = querystring.unescape(querystring.stringify(req.query)).replace("$=","$");
  // console.log(queryString)
  var image = "http://cdn.media.amplience.net/i/bccdemo/" + req.params[0] + "?" + queryString + "&w=" + req.headers.width;
      // console.log(req.query)
      console.log(image); // captures correctly the image name
      req.pipe(request(image)).pipe(res)
})

app.get('/af-tester/:endpoint/*',async function(req,res){
  let queryString = querystring.unescape(querystring.stringify(req.query)).replace("$=","$");
  console.log(req.params[0])
  console.log(req.params.endpoint)
  console.log(queryString);

  res.render('af-tester',{
    static_path:'/static',
    theme:process.env.THEME || 'flatly',
    pageTitle : "HomePage",
    pageDescription : "Homepage",
    query:req.query,
    endpoint:req.params.endpoint,
    origImage:req.params[0] + '?' + queryString
    
  }) 
})

app.get('/repoUserInfo',async function(req,res,next){
  const authToken = await getAuthToken("password",{});
  const Repos = await getRepos("password","5c542378c9e77c000120b94b",authToken)
  const Items = await getContentItems("password",Repos,authToken)
  var ItemAuthors = jp.query(Items,'$..Author').filter((v,i,a)=>a.indexOf(v)==i)
  var RepoUserData = []
  for (const author of ItemAuthors){
    console.log(author);
    var RepoUserDataObject = jp.query(Items,'$[?(@.Author=="'+author+'")].RepoId').filter((v,i,a)=>a.indexOf(v)==i)
    // console.log(RepoUserDataObject);
    RepoUserData.push({"author":author,"repos":RepoUserDataObject});
  }
   //get Repo's for a particular author')
  res.send(RepoUserData);
})



app.get('/reposInfo',async function(req,res,next){
  const authToken = await getAuthToken("password");
  const Hubs = await getHubs("password",authToken)
  try{
    getAuthToken("password")
      .then(authToken =>{
        var repoDataArray = []
        for(const hub of Hubs){
          //res.send(hub);
          axios({
            method:"get",
            url:"https://api.amplience.net/v2/content/hubs/"+hub[0]+"/content-repositories?n=100",
            headers:{
              "Authorization": "Bearer " + authToken
            }
          })
          .then(response => {
            var repoIds = jp.query(response.data,'$._embedded["content-repositories"]..id')
            var repoCount = jp.query(response.data,'$.page.totalElements')
            var repoDataObj = {
              "hub":hub[0],
              "label":hub[1],
              "endpoint":hub[2],
              "data":{
                "repoIds":repoIds,
                "repoCount":repoCount
              }
            }
            repoDataArray.push(repoDataObj);
            if (repoDataArray.length == Hubs.length){
              res.send(repoDataArray);      
            }
            
          })
          .catch(error => {
            console.error("errno: " + error.errno);
            console.error("code: " + error.code);
            console.error("url: " + error.config.url);
            console.error("\n\n-----\n\n");
            var dummyrepoDataObj = {
              "hub":hub[0],
              "label":hub[1],
              "endpoint":hub[2],
              "data":{
                "repoIds":['123456'],
                "repoCount":123456
              }
            }
            repoDataArray.push(dummyrepoDataObj)
            //next(error)
          });
          

        }
        
    })      
  }
  catch (e) {
    next(e)
  }
})


app.get('/carousel',async function(req,res,next){
  vseEnvironment = req.query.vse || process.env.VSE_ENV
  console.log("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store);
  let content = await axios.get("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  await getImgData(content.data['@graph']);
  var contentGraph = amp.inlineContent(content.data);
  // var stringContent = JSON.stringify(contentGraph,null,'\t');
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
  vseEnvironment = req.query.vse || process.env.VSE_ENV
  // console.error("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  let content = await axios.get("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  //await getImgData(content.data['@graph']);
  var contentGraph = amp.inlineContent(content.data);
  // var stringContent = JSON.stringify(contentGraph,null,'\t');
  // console.log(JSON.stringify(req.headers));
  res.render('panels',{
    static_path:'/static',
    theme:process.env.THEME || 'flatly',
    pageTitle : "HomePage",
    pageDescription : "Homepage",
    query:req.query,
    content:contentGraph[0],
    productName: "This is a Dumb Product",
    dpr:req.headers.dpr,
    "viewport-width":req.headers["viewport-width"],
    rtt:req.headers.rtt,
    downlink:req.headers.downlink,
    ect:req.headers.ect
  })
})

app.get('/panels-ch',async function(req,res,next){
  vseEnvironment = req.query.vse || process.env.VSE_ENV
  // console.error("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  let content = await axios.get("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  await getImgData(content.data['@graph']);
  var contentGraph = amp.inlineContent(content.data);
  // var stringContent = JSON.stringify(contentGraph,null,'\t');
  console.log(JSON.stringify(req.headers));
  res.render('panels-ch',{
    static_path:'/static',
    theme:process.env.THEME || 'flatly',
    pageTitle : "HomePage",
    pageDescription : "Homepage",
    query:req.query,
    content:contentGraph[0],
    productName: "This is a Dumb Product",
    dpr:req.headers.dpr,
    "viewport-width":req.headers["viewport-width"],
    rtt:req.headers.rtt,
    downlink:req.headers.downlink,
    ect:req.headers.ect
  })
})

app.get('/panels-ir',async function(req,res,next){
  vseEnvironment = req.query.vse || process.env.VSE_ENV
  // console.error("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  let content = await axios.get("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  await getImgData(content.data['@graph']);
  var contentGraph = amp.inlineContent(content.data);
  // var stringContent = JSON.stringify(contentGraph,null,'\t');
  console.log(JSON.stringify(req.headers));
  res.render('panels-ir',{
    static_path:'/static',
    theme:process.env.THEME || 'flatly',
    pageTitle : "Image Recognition Demo",
    pageDescription : "Image Recognition Demo",
    query:req.query,
    content:contentGraph[0],
    productName: "This is a Dumb Product",
    dpr:req.headers.dpr,
    "viewport-width":req.headers["viewport-width"],
    rtt:req.headers.rtt,
    downlink:req.headers.downlink,
    ect:req.headers.ect
  })
})


app.get('/showJSON', async function(req,res,next){
  vseEnvironment = req.query.vse || process.env.VSE_ENV
  console.log("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  let content = await axios.get("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  //await getImgData(content.data['@graph']);
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




app.get('/upload-svg',function(req,res){
  res.render('upload-svg',{
    static_path:'/static',
    theme:process.env.THEME || 'flatly',
    pageTitle : "Upload SVG",
    pageDescription : "Upload SVG",
    query:req.query
  })
})

app.get('/fetch-test',function(req,res){
  res.render('fetch-api',{
    static_path:'/static',
    theme:process.env.THEME || 'flatly',
    pageTitle : "Fetch API test",
    pageDescription : "Fetch API test",
    query:req.query
  })
})

app.get('/pdp',function(req,res){
  res.render('pdp',{
    static_path:'/static',
    theme:process.env.THEME || 'flatly',
    pageTitle : "Upload SVG",
    pageDescription : "Upload SVG",
    query:req.query,
    content:contentGraph[0],
    prod:{
      name:"Some Dumb Product Name",
      price:{
        now:"£1.99",
        was:"£3.99",
        saving:"£2"
      },
      swatches:[
        {
          textureID:123,
          textureSrc:"http://someimgref",
          textureName:"Woodyness"
        },
        {
          textureID:456,
          textureSrc:"http://imgref456",
          textureName:"Metalness"
        }
      ]
    }
  })
})


app.post('/submit-form', (req,res,next) => {
      new formidable.IncomingForm().parse(req, function(err,fields, files){
        var oldpath = files.document.path;
        var newpath = path.join(__dirname,'/static/') + files.document.name;
        fs.rename(oldpath, newpath, function (error) {
          if (error) throw error;
          console.log('File uploaded and moved!');
          request({
            url: 'https://draping-convert.dev.adis.ws/svgToAMPD',
            method: 'POST',
            headers: {
              'cache-control': 'no-cache',
              'content-type' : 'image/svg+xml'
            },
            encoding: null,
            body: fs.createReadStream(newpath)
           }, (renameError, response, body) => {
                if (renameError) {
                   res.send(renameError)
                } else {
                  res.send(response.body)
                }
           });
          /* axios({
            method:"post",
            headers:{
              "Content-Type":"image/svg+xml"
            },
            url:"https://draping-convert.dev.adis.ws/svgToAMPD",
            body:fs.createReadStream(newpath)
          })
          .then(function(convertedResponse){
            console.log("convert SVG 200")
            console.log(converterResponse)
          })
          .catch(function(error){
            console.log("convert SVG Error")
            console.log(error)
          }) */

        });

      })
    })

const patchAMPDValue = function(authToken,contentItem,req,ampD){
  axios({
    method:"patch",
    url:"http://"+cmsEnvironment+"/content-items/"+req.query.id,
    headers:{
      "Authorization":"Bearer "+ authToken,
      "Content-Type":"application/json"
    },
    data:{
      "body": {
        "_meta": contentItem.data.body._meta,
        "SVG": contentItem.data.body.SVG,
        "Textures": contentItem.data.body.Textures,
        "AMPD":ampD
      },
      "version":contentItem.data.version
    }
  })
  .then(patchItemResp => {
    console.log(patchItemResp.config)
  })
  .catch(patchItemErr=>{
    console.log("Full Error:")
    console.log(patchItemErr)
    console.log("patch body")
    console.log(JSON.stringify(patchItemErr.config.body))
  })
}

const getContentItem = function(authToken,req){
  return new Promise(function(resolve, reject){
    axios({
      method:"get",
      url:"http://"+cmsEnvironment+"/content-items/"+req.query.id,
      headers:{
        "Authorization":"Bearer "+ authToken,
        "Content-Type":"application/json"
      }
    })
    .then(getItemResp =>{
      resolve(getItemResp);
    })
    .catch(getItemErr =>{
      reject(getItemErr)
    })
  })
};

const postSvgToAMPD = function(svgPath){
  return new Promise(function(resolve, reject){
    request({
      url: 'https://draping-convert.dev.adis.ws/svgToAMPD',
      method: 'POST',
      headers: {
        'cache-control': 'no-cache',
        'content-type' : 'image/svg+xml'
      },
      encoding: null,
      body: fs.createReadStream(svgPath)
    }, (error, response, body) => {
    if (error) {
        reject(error)
    }
    else {
       let ampD = response.body.toString('utf8')
       resolve(ampD);
    }
   })
  })
}

const createTextureArray = function(tetureObj){
    let texturePathArray = []
    tetureObj.forEach(function(texture){
      texturePathArray.push("https://"+imgSrc+"/i/"+texture.Texture.endpoint+"/"+texture.Texture.name)
    })
    return texturePathArray
}
const createTextureMatricesArray = function(tetureObj){
    let textureMatricesArray = []
    tetureObj.forEach(function(texture){
      const tmat = glmatrix.mat2d.fromTranslation(glmatrix.mat2d.create(), [0.5, 0.5]);
      glmatrix.mat2d.scale(tmat, tmat, [texture.scaleX, texture.scaleY]);
      glmatrix.mat2d.rotate(tmat, tmat, texture.rotation);
      glmatrix.mat2d.translate(tmat, tmat, [texture.offsetX, texture.offsetY]);
      // console.log(glmatrix.mat3.fromMat2d(glmatrix.mat3.create(), tmat));
      textureMatricesArray.push(Array.from(glmatrix.mat3.fromMat2d(glmatrix.mat3.create(), tmat)))
    })
    return textureMatricesArray
}

const renderDrape = function(ampD,textureObj,req,res){
  request({
    url: 'https://draping.dev.adis.ws/renderUrls',
    method: 'POST',
    headers: {
      'cache-control': 'no-cache',
      'Content-Type' : 'application/json'
    },
    encoding: null,
    body: {
      "ampd":ampD,
      "textures": createTextureArray(textureObj),
      "textureMatrices":createTextureMatricesArray(textureObj),
      "format": "jpg",
      "lossyQuality": 80
    },
    json:true
    }, (renderError, renderResponse, renderBody) => {
          if (renderError) {
             res.send(renderError)
          } else {

            res.render('draping',{
              static_path:'/static',
              theme:process.env.THEME || 'flatly',
              pageTitle : "Upload SVG",
              pageDescription : "Upload SVG",
              query:req.query,
              imageData:renderResponse.body.toString('base64')
            })
          }
     });
}

app.get('/draping', async function(req,res,next){
  vseEnvironment = req.query.vse || process.env.VSE_ENV
  // console.log("http://"+ req.query.vse +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  let content = await axios.get("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  // await getImgData(content.data['@graph']);
  var contentGraph = amp.inlineContent(content.data);
  var svgData = contentGraph[0].SVG
  var textureData = contentGraph[0].Textures
  var newpath = path.join(__dirname,'/static/') + svgData.name + ".svg";
  if (typeof contentGraph[0].AMPD !== 'undefined'){
    if (contentGraph[0].AMPD.indexOf('ampd') > 1){
      /* getAuthToken().then(authToken =>{
        getContentItem(authToken,req).then(getItemResp =>{
          patchAMPDValue(authToken,getItemResp,req,ampD)
        })
        .catch(getItemErr => {
          console.log(getItemErr)
        })
      })
      .catch(getAuthTokenError => {
        console.log(getAuthTokenError)
      }) */
      renderDrape(contentGraph[0].AMPD,textureData,req,res)
    }
  }
  else {
    var file = fs.createWriteStream(newpath)
    const svgReq = request.get("https://"+imgSrc+"/i/"+svgData.endpoint+"/"+svgData.name+".svg")
    svgReq.on('response',function(response){
      if (response.statusCode !== 200) {
          console.log('Response status was ' + response.statusCode);
      }
      console.log('Response status was ' + response.statusCode)
      svgReq.pipe(file);
    })
    file.on('finish', function() {
      file.close(function(){
        console.log("file saved to server")
         postSvgToAMPD(newpath).then(ampD => {
          getAuthToken().then(authToken =>{
            getContentItem(authToken,req).then(getItemResp =>{
              patchAMPDValue(authToken,getItemResp,req,ampD)
            })
            .catch(getItemErr => {
              console.log(getItemErr)
            })
          })
          .catch(getAuthTokenError => {
            console.log(getAuthTokenError)
          })

          renderDrape(ampD,textureData,req,res)

        })
        .catch(postSvgToAMPDErr => {
          console.log(postSvgToAMPDErr)
        })

      });
    });

    svgReq.on('error', (err) => {
      fs.unlink(newpath);
      console.log(err.message);
    });

    file.on('error', (err) => { // Handle errors
        fs.unlink(newpath); // Delete the file async. (But we don't check the result)
        console.log(err.message);
    });

  }


  // var stringContent = JSON.stringify(contentGraph,null,'\t');
})
