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

const getAuthToken = function(){
  return new Promise(function(resolve, reject){
    axios({
      method:"post",
      url:"https://auth.adis.ws/oauth/token",
      params:{
        client_id:clientId,
        client_secret:apiSecret,
        grant_type:"client_credentials",
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

app.get('/retrieveImage/:name', function(req,res,next){
  console.log(req.headers);
  var image = "http://i1.adis.ws/i/bccdemo/" + req.params.name + "&w=" + req.headers.width;
      console.log(image); // captures correctly the image name
      req.pipe(request(image)).pipe(res)
})

app.get('/retrieveImagePOI/:name', function(req,res,next){
  console.log(req.headers);
  var image = "http://i1.adis.ws/i/bccdemo/" + req.params.name + "?$poi$&w="+  + req.headers.width +"&sm=aspect&aspect=1:1";
      console.log(image); // captures correctly the image name
      req.pipe(request(image)).pipe(res)
})

const getImgData = async function (graph) {
    let promises = [];
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
  await getImgData(content.data['@graph']);
  var contentGraph = amp.inlineContent(content.data);
  var stringContent = JSON.stringify(contentGraph,null,'\t');
  console.log("viewport-width: " + req.headers['viewport-width'] + "\n")
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
              console.log(response);
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
  vseEnvironment = req.query.vse || process.env.VSE_ENV
  console.log("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store);
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
  vseEnvironment = req.query.vse || process.env.VSE_ENV
  // console.error("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  let content = await axios.get("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
  await getImgData(content.data['@graph']);
  var contentGraph = amp.inlineContent(content.data);
  var stringContent = JSON.stringify(contentGraph,null,'\t');
  console.log(JSON.stringify(req.headers));
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
  var stringContent = JSON.stringify(contentGraph,null,'\t');
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


app.get('/showJSON', async function(req,res,next){
  vseEnvironment = req.query.vse || process.env.VSE_ENV
  console.log("http://"+ vseEnvironment +"/cms/content/query?fullBodyObject=true&query=%7B%22sys.iri%22:%22http://content.cms.amplience.com/"+ req.query.id +"%22%7D&scope=tree&store=" + req.query.store)
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




app.get('/upload-svg',function(req,res){
  res.render('upload-svg',{
    static_path:'/static',
    theme:process.env.THEME || 'flatly',
    pageTitle : "Upload SVG",
    pageDescription : "Upload SVG",
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
        fs.rename(oldpath, newpath, function (err) {
          if (err) throw err;
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
           }, (error, response, body) => {
                if (error) {
                   res.send(error)
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
       ampD = response.body.toString('utf8')
       resolve(ampD);
    }
   })
  })
}

const createTextureArray = function(tetureObj){
    texturePathArray = []
    tetureObj.forEach(function(texture){
      texturePathArray.push("https://"+imgSrc+"/i/"+texture.Texture.endpoint+"/"+texture.Texture.name)
    })
    return texturePathArray
}
const createTextureMatricesArray = function(tetureObj){
    textureMatricesArray = []
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


  var stringContent = JSON.stringify(contentGraph,null,'\t');
})
