var npid = require('npid');
 
try {
    var pid = npid.create('hue.sensors.poller.pid');
    pid.removeOnExit();
} catch (err) {
    console.log(err);
    process.exit(1);
}

var CONFIG = require('./config.json');

var http = require('http');
var hueHubGetSensors = {
  host: CONFIG.HUEHUB_HOST,
  port: CONFIG.HUEHUB_PORT,
  path: '/api/' + CONFIG.HUEAPIKEY + '/sensors/',
  method: 'GET'
};
var hueHubGetLights = {
  host: CONFIG.HUEHUB_HOST,
  port: CONFIG.HUEHUB_PORT,
  path: '/api/' + CONFIG.HUEAPIKEY + '/lights/',
  method: 'GET'
};
setInterval(function () {
  getSensorStatus();
  getLightStatus();
}, CONFIG.POLLINGTIME);

function getSensorStatus()
{
  console.log("Connecting to hueHub IP:" + CONFIG.HUEHUB_HOST + "PORT:" + CONFIG.HUEHUB_PORT);
  var reqGet = http.request(hueHubGetSensors, function (res) {
    var content;

    res.on('data', function (chunk) {
      content += chunk;
    });
    res.on('end', function () {
      // remove 'undefined that appears before JSON for some reason
      jsonContent = JSON.parse(content.substring(9, content.length));
      for (var key in jsonContent) {
        if (jsonContent.hasOwnProperty(key)) {
            var data=jsonContent[key];
            writeHueSensorToInflux(
              data.name,
              data.type,
              parseInt(getSensorId(data.name)),
              data.state.temperature,
              data.state.presence,
              data.state.lightlevel,
              data.state.dark,
              data.state.daylight,
              data.state.buttonevent,
              data.state.status
            );
        }
    }
    
    });
  });

  reqGet.end();
  reqGet.on('error', function (e) {
    console.error(e);
  });
}

function getLightStatus()
{
  console.log("Connecting to hueHub IP:" + CONFIG.HUEHUB_HOST + "PORT:" + CONFIG.HUEHUB_PORT);
  var reqGet = http.request(hueHubGetLights, function (res) {
    var content;

    res.on('data', function (chunk) {
      content += chunk;
    });
    res.on('end', function () {
      // remove 'undefined that appears before JSON for some reason
      jsonContent = JSON.parse(content.substring(9, content.length));
      for (var key in jsonContent) {
        if (jsonContent.hasOwnProperty(key)) {
            var data=jsonContent[key];
            writeHueLightToInflux(
              data.name,
              data.type,
              data.state.on,
              data.state.bri,
              data.state.hue,
              data.state.sat
            );
        }
    }
    
    });
  });

  reqGet.end();
  reqGet.on('error', function (e) {
    console.error(e);
  });
}

function getSensorId(sensor_name) {
  var prefix = "sensor ";
  var n = sensor_name.indexOf(prefix);
  return sensor_name.substring(n + prefix.length);
}

function writeHueSensorToInflux(
  name,
  type,
  sensorid,
  temperature,
  presence,
  lightlevel,
  dark,
  daylight,
  buttonevent,
  status
) {
  const Influx = require('influx');
  const influx = new Influx.InfluxDB({
    host: CONFIG.INFLUXDB_HOST,
    database: CONFIG.INFLUXDB_HUESENSOR_DB,
    schema: [
      {
        measurement: 'HueSensor',
        fields: {
          temperature: Influx.FieldType.INTEGER,
          presence: Influx.FieldType.BOOLEAN,
          lightlevel: Influx.FieldType.INTEGER,
          dark: Influx.FieldType.BOOLEAN,
          daylight: Influx.FieldType.BOOLEAN,
          buttonevent: Influx.FieldType.INTEGER,
          status: Influx.FieldType.INTEGER
        },
        tags: [
          'name','type','sensorid'
        ]
      }
    ]
  })
  console.log("Sending sensors data to Influx DB...")
  influx.writePoints([
    {
      measurement: 'HueSensor',
      tags: { name, type, sensorid},
      fields: { temperature,presence,lightlevel,dark,daylight,buttonevent,status }
    }
  ]);
}

function writeHueLightToInflux(
  name,
  type,
  on,
  bri,
  hue,
  sat
) {
  const Influx = require('influx');
  const influx = new Influx.InfluxDB({
    host: CONFIG.INFLUXDB_HOST,
    database: CONFIG.INFLUXDB_HUESENSOR_DB,
    schema: [
      {
        measurement: 'HueLight',
        fields: {
          on: Influx.FieldType.BOOLEAN,
          bri: Influx.FieldType.INTEGER,
          hue: Influx.FieldType.INTEGER,
          sat: Influx.FieldType.INTEGER
        },
        tags: [
          'name','type'
        ]
      }
    ]
  })
  console.log("Sending lights data to Influx DB...")
  influx.writePoints([
    {
      measurement: 'HueLight',
      tags: { name, type},
      fields: { on,bri,hue,sat }
    }
  ]);
}
