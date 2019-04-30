'use strict';

TABS.gps = {};
TABS.gps.msp = {};
TABS.gps.initialize = function (callback) {

    if (GUI.active_tab != 'gps') {
        GUI.active_tab = 'gps';
        googleAnalytics.sendAppView('GPS');
    }

    function load_html() {
        $('#content').load("./tabs/gps.html", process_html);
    }

    load_html();

    let cursorInitialized = false;
    let iconStyle;
    let mapHandler;
    let iconGeometry;
    let iconFeature;

    function process_html() {
        localize();

        let mapLayer;

        if (globalSettings.mapProviderType == 'bing') {
            mapLayer = new ol.source.BingMaps({
                key: globalSettings.mapApiKey,
                imagerySet: 'AerialWithLabels',
                maxZoom: 19
            });
        } else if ( globalSettings.mapProviderType == 'mapproxy' ) {
        	mapLayer = new ol.source.TileWMS({
        		url: globalSettings.proxyURL,
                params: {'LAYERS':globalSettings.proxyLayer}
             })               
        } else {
            mapLayer = new ol.source.OSM();
        }

        var lat = (GPS_DATA ? (GPS_DATA.lat / 10000000) : 0);
        var lon = (GPS_DATA ? (GPS_DATA.lon / 10000000) : 0);

        mapHandler = new ol.Map({
            target: document.getElementById('gps-map'),
            layers: [
                new ol.layer.Tile({
                    source: mapLayer
                })
            ],
            view: new ol.View({
                center: ol.proj.fromLonLat([lon, lat]),
                zoom: 2
            })
        });

        function get_raw_gps_data() {
            MSP.send_message(MSPCodes.MSP_RAW_GPS, false, false, get_comp_gps_data);
        }

        function get_comp_gps_data() {
            MSP.send_message(MSPCodes.MSP_COMP_GPS, false, false, get_gpsstatistics_data);
        }

        function get_gpsstatistics_data() {
            MSP.send_message(MSPCodes.MSP_GPSSTATISTICS, false, false, update_ui);
        }

        function get_attitude_info(callback) {
/*
            case MSPCodes.MSP_ATTITUDE:
                SENSOR_DATA.kinematics[0] = data.getInt16(0, true) / 10.0; // x roll
                SENSOR_DATA.kinematics[1] = data.getInt16(2, true) / 10.0; // y pitch
                SENSOR_DATA.kinematics[2] = data.getInt16(4, true); // z yaw
MSP_RC_TUNING
MSPV2_INAV_RATE_PROFILE
MSP_SET_POSITION_ESTIMATION_CONFIG
*/
            //console.log("get_attitude_info");
            MSP.send_message(MSPCodes.MSP_ATTITUDE, false, false, function() {
                MSP.send_message(MSPCodes.MSP_SERVO, false, false, function() {
                    MSP.send_message(MSPCodes.MSP_MOTOR, false, false, function() {
                        //console.log("complete get_attitude_info");
                        //console.log(SENSOR_DATA.kinematics);
                        //console.log(SERVO_DATA);
                        //console.log(MOTOR_DATA);
                        if (callback) callback();
                    });
                });
            });
        }

        function updateGpsSensorSettings() {
            // check GPS settings, don't initialize if GPS is disabled or other than MSP
            var gps_enabled = false;
            var features = FC.getFeatures();
            for (i = 0; i < features.length; i++) {
                if (features[i].name.toLowerCase() == 'gps') {
                    gps_enabled = bit_check(BF_CONFIG.features, features[i].bit);
                    break;
                }
            }
            var gpsProtocols = FC.getGpsProtocols();
            var gps_protocol = gpsProtocols[MISC.gps_type];
            //console.log("gps_enabled", gps_enabled);
            //console.log("gps_protocol: ", gps_protocol);
            //console.log("have_sensor gps: ", have_sensor(CONFIG.activeSensors, 'gps'));
            //console.log("gpsHwStatus: ", SENSOR_STATUS.gpsHwStatus);
            TABS.gps.msp.flagGpsFeatureEnabled = gps_enabled;
            TABS.gps.msp.flagMspProtocolSelected = (gps_protocol != "MSP");
        }

        function initMspData() {
            fb("--- initMspData");

            updateGpsSensorSettings();
            if (!TABS.gps.msp.flagGpsFeatureEnabled || TABS.gps.msp.flagMspProtocolSelected) {
                return;
            }

            if (TABS.gps.msp.initialized) {
                // show current values if returning back to tab
                refreshMspDataValues();
            } else {
                // initialize only first time
                TABS.gps.msp.flagSendDataActive = true;
                TABS.gps.msp.flagSendDataAutoAttitudeCoord = true;
                TABS.gps.msp.flagSendDataAutoAttitudeAlt = false;
                TABS.gps.msp.flagSendDataAutoAttitudeSpeed = false;
            }

            $('#gps-send-data-active').prop("checked", TABS.gps.msp.flagSendDataActive).change(function () {
                TABS.gps.msp.lastMessageMs = new Date().getTime();
                TABS.gps.msp.flagSendDataActive = $(this).is(":checked");
            }).change();

            $('#gps-send-auto-attitude-coord').prop("checked", TABS.gps.msp.flagSendDataAutoAttitudeCoord).change(function () {
                TABS.gps.msp.lastMessageMs = new Date().getTime();
                TABS.gps.msp.flagSendDataAutoAttitudeCoord = $(this).is(":checked");
                $('#gps-send-lat').prop('disabled', TABS.gps.msp.flagSendDataAutoAttitudeCoord);
                $('#gps-send-lon').prop('disabled', TABS.gps.msp.flagSendDataAutoAttitudeCoord);
            }).change();

            $('#gps-send-auto-attitude-alt').prop("checked", TABS.gps.msp.flagSendDataAutoAttitudeAlt).change(function () {
                TABS.gps.msp.lastMessageMs = new Date().getTime();
                TABS.gps.msp.flagSendDataAutoAttitudeAlt = $(this).is(":checked");
                $('#gps-send-alt').prop('disabled', TABS.gps.msp.flagSendDataAutoAttitudeAlt);
            }).change().prop('disabled', true);

            $('#gps-send-auto-attitude-speed').prop("checked", TABS.gps.msp.flagSendDataAutoAttitudeSpeed).change(function () {
                TABS.gps.msp.lastMessageMs = new Date().getTime();
                TABS.gps.msp.flagSendDataAutoAttitudeSpeed = $(this).is(":checked");
                $('#gps-send-speed').prop('disabled', TABS.gps.msp.flagSendDataAutoAttitudeSpeed);
            }).change().prop('disabled', true);

            $('#gps-send-fix-type').change(function () {
                TABS.gps.msp.GPS_DATA.fix = parseInt($(this).val());
            });
            $('#gps-send-sats').change(function () {
                TABS.gps.msp.GPS_DATA.numSat = parseInt($(this).val());
            });
            $('#gps-send-lat').change(function () {
                TABS.gps.msp.GPS_DATA.lat = parseInt($(this).val());
            });
            $('#gps-send-lon').change(function () {
                TABS.gps.msp.GPS_DATA.lon = parseInt($(this).val());
            });
            $('#gps-send-alt').change(function () {
                TABS.gps.msp.GPS_DATA.alt = parseInt($(this).val());
            });
            $('#gps-send-speed').change(function () {
                TABS.gps.msp.GPS_DATA.speed = parseInt($(this).val());
            });

            $('.tab-gps .send-data-box').show();

            // initialize only once per app session
            if (TABS.gps.msp.initialized) return;
            console.log("---------- initMspData ----------");

            TABS.gps.msp.GPS_DATA = {};
            TABS.gps.msp.GPS_DATA.fix = 2;
            TABS.gps.msp.GPS_DATA.numSat = 12;
            TABS.gps.msp.GPS_DATA.lat = 417766246;
            TABS.gps.msp.GPS_DATA.lon = 123831153;
            TABS.gps.msp.GPS_DATA.alt = 120;
            TABS.gps.msp.GPS_DATA.speed = 100;

            $('#gps-send-alt').val(parseInt(TABS.gps.msp.GPS_DATA.alt));
            $('#gps-send-speed').val(parseInt(TABS.gps.msp.GPS_DATA.speed));

            TABS.gps.msp.now = new Date().getTime();
            TABS.gps.msp.lastMessageMs = TABS.gps.msp.now;
            TABS.gps.msp.deltaMs = 0;

            /* */
            TABS.gps.msp.busy = false;
            setInterval(function() {
                if (!TABS.gps.msp.flagSendDataActive) return;

                if (TABS.gps.msp.busy) return;
                //console.log("------ cycle ------");
                TABS.gps.msp.busy = true;
                TABS.gps.msp.msStartCycle = new Date().getTime();

                if (TABS.gps.msp.flagSendDataAutoAttitudeCoord || TABS.gps.msp.flagSendDataAutoAttitudeAlt || TABS.gps.msp.flagSendDataAutoAttitudeSpeed) {
                    get_attitude_info(function() {
                        updateMspData(callbackSendMspData);
                    });
                } else {
                    sendMspData(callbackSendMspData);
                }

            }, 500);
            /* */

            var callbackSendMspData = function() {
                TABS.gps.msp.busy = false;
                console.log("----- cycle duration: ", ((new Date().getTime()) - TABS.gps.msp.msStartCycle));
            }

            TABS.gps.msp.initialized = true;
        }

        function updateMspData(callback) {

            TABS.gps.msp.now = new Date().getTime();
            TABS.gps.msp.deltaMs = TABS.gps.msp.now - TABS.gps.msp.lastMessageMs;
            TABS.gps.msp.lastMessageMs = TABS.gps.msp.now;
            //console.log("-----  updateMspData  ", "deltaMs", TABS.gps.msp.deltaMs);

            TABS.gps.msp.GPS_DATA.numSat = (14 + 2 - parseInt(Math.random() * 2));

            if (TABS.gps.msp.flagSendDataAutoAttitudeAlt) {
                // TODO
                //TABS.gps.msp.GPS_DATA.alt
            }

            if (TABS.gps.msp.flagSendDataAutoAttitudeSpeed) {
                // TODO
                //TABS.gps.msp.GPS_DATA.speed = (500 + 3 - parseInt(Math.random() * 3));
            }

            if (TABS.gps.msp.flagSendDataAutoAttitudeCoord) {
                var cmDelta = TABS.gps.msp.GPS_DATA.speed * (TABS.gps.msp.deltaMs / 1000.0);
                TABS.gps.msp.GPS_DATA.lat += ((cmDelta * Math.cos(toRadians(SENSOR_DATA.kinematics[2]))) / 1.11);
                TABS.gps.msp.GPS_DATA.lon += ((cmDelta * Math.sin(toRadians(SENSOR_DATA.kinematics[2]))) / 1.11);
                //console.log(cmDelta, SENSOR_DATA.kinematics[2], (TABS.gps.msp.GPS_DATA.lat / 1e7), (TABS.gps.msp.GPS_DATA.lon / 1e7));
            }

            refreshMspDataValues();

            sendMspData(callback);
        }

        function refreshMspDataValues() {
            $('#gps-send-fix-type').val((TABS.gps.msp.GPS_DATA.fix >= 2) ? 2 : ((TABS.gps.msp.GPS_DATA.fix >= 1) ? 1 : 0));
            $('#gps-send-sats').val(parseInt(TABS.gps.msp.GPS_DATA.numSat));
            if (TABS.gps.msp.flagSendDataAutoAttitudeCoord) {
                $('#gps-send-lat').val(parseInt(TABS.gps.msp.GPS_DATA.lat));
                $('#gps-send-lon').val(parseInt(TABS.gps.msp.GPS_DATA.lon));
            }
            if (TABS.gps.msp.flagSendDataAutoAttitudeAlt) {
                $('#gps-send-alt').val(parseInt(TABS.gps.msp.GPS_DATA.alt));
            }
            if (TABS.gps.msp.flagSendDataAutoAttitudeSpeed) {
                $('#gps-send-speed').val(parseInt(TABS.gps.msp.GPS_DATA.speed));
            }
        }

        function sendMspData(callback) {
            //console.log("sendMspData");

            var buffer = [];
            buffer.push(parseInt(TABS.gps.msp.GPS_DATA.fix));
            buffer.push(parseInt(TABS.gps.msp.GPS_DATA.numSat));
            buffer.push(specificByte(TABS.gps.msp.GPS_DATA.lat, 0));
            buffer.push(specificByte(TABS.gps.msp.GPS_DATA.lat, 1));
            buffer.push(specificByte(TABS.gps.msp.GPS_DATA.lat, 2));
            buffer.push(specificByte(TABS.gps.msp.GPS_DATA.lat, 3));
            buffer.push(specificByte(TABS.gps.msp.GPS_DATA.lon, 0));
            buffer.push(specificByte(TABS.gps.msp.GPS_DATA.lon, 1));
            buffer.push(specificByte(TABS.gps.msp.GPS_DATA.lon, 2));
            buffer.push(specificByte(TABS.gps.msp.GPS_DATA.lon, 3));
            buffer.push(lowByte(TABS.gps.msp.GPS_DATA.alt));
            buffer.push(highByte(TABS.gps.msp.GPS_DATA.alt));
            buffer.push(lowByte(TABS.gps.msp.GPS_DATA.speed));
            buffer.push(highByte(TABS.gps.msp.GPS_DATA.speed));

            /* */
            MSP.send_message(MSPCodes.MSP_SET_RAW_GPS, buffer, false, function(data) {
                //console.log("callback_msp");
                //console.log(data);
                if (callback) callback();
            });
            /* */

        }

        function toDegrees(angle) {
            return angle * (180 / Math.PI);
        }

        function toRadians(angle) {
            return angle * (Math.PI / 180);
        }

        function update_ui() {

            let lat = GPS_DATA.lat / 10000000;
            let lon = GPS_DATA.lon / 10000000;

            let gpsFixType = chrome.i18n.getMessage('gpsFixNone');
            if (GPS_DATA.fix >= 2) {
                gpsFixType = chrome.i18n.getMessage('gpsFix3D');
            } else if (GPS_DATA.fix >= 1) {
                gpsFixType = chrome.i18n.getMessage('gpsFix2D');
            }
            
            $('.GPS_info td.fix').html(gpsFixType);
            $('.GPS_info td.alt').text(GPS_DATA.alt + ' m');
            $('.GPS_info td.lat').text(lat.toFixed(4) + ' deg');
            $('.GPS_info td.lon').text(lon.toFixed(4) + ' deg');
            $('.GPS_info td.speed').text(GPS_DATA.speed + ' cm/s');
            $('.GPS_info td.sats').text(GPS_DATA.numSat);
            $('.GPS_info td.distToHome').text(GPS_DATA.distanceToHome + ' m');

            let gpsRate = 0;
            if (GPS_DATA.messageDt > 0) {
                gpsRate = 1000 / GPS_DATA.messageDt;
            }

            $('.GPS_stat td.messages').text(GPS_DATA.packetCount);
            $('.GPS_stat td.rate').text(gpsRate.toFixed(1) + ' Hz');
            $('.GPS_stat td.errors').text(GPS_DATA.errors);
            $('.GPS_stat td.timeouts').text(GPS_DATA.timeouts);
            $('.GPS_stat td.eph').text((GPS_DATA.eph / 100).toFixed(2) + ' m');
            $('.GPS_stat td.epv').text((GPS_DATA.epv / 100).toFixed(2) + ' m');
            $('.GPS_stat td.hdop').text((GPS_DATA.hdop / 100).toFixed(2));

            //Update map
            if (GPS_DATA.fix >= 2) {

                if (!cursorInitialized) {
                    cursorInitialized = true;

                    iconStyle = new ol.style.Style({
                        image: new ol.style.Icon(({
                            anchor: [0.5, 1],
                            opacity: 1,
                            scale: 0.5,
                            src: '../images/icons/cf_icon_position.png'
                        }))
                    });
            
                    let currentPositionLayer;
                    iconGeometry = new ol.geom.Point(ol.proj.fromLonLat([0, 0]));
                    iconFeature = new ol.Feature({
                        geometry: iconGeometry
                    });
            
                    iconFeature.setStyle(iconStyle);
            
                    let vectorSource = new ol.source.Vector({
                        features: [iconFeature]
                    });
                    currentPositionLayer = new ol.layer.Vector({
                        source: vectorSource
                    });
            
                    mapHandler.addLayer(currentPositionLayer);
                }

                let center = ol.proj.fromLonLat([lon, lat]);
                iconGeometry.setCoordinates(center);
                if ($('#gps-info-center-map').prop("checked")) {
                    mapHandler.getView().setCenter(center);
                    mapHandler.getView().setZoom(14);
                }
            }
        }

//$('.tab-gps .send-data-box').show();
if (!CONFIG) {
    GUI.content_ready(callback);
    return;
}
        /*
         * enable data pulling
         * GPS is usually refreshed at 5Hz, there is no reason to pull it much more often, really...
         */
        helper.mspBalancedInterval.add('gps_pull', 200, 3, function gps_update() {
            // avoid usage of the GPS commands until a GPS sensor is detected for targets that are compiled without GPS support.
            if (!have_sensor(CONFIG.activeSensors, 'gps')) {
                update_ui();
                return;
            }

            if (helper.mspQueue.shouldDrop()) {
                return;
            }

            get_raw_gps_data();
        });

        /* */
        initMspData();
        /* */

        GUI.content_ready(callback);
    }

};

TABS.gps.cleanup = function (callback) {
    if (callback) callback();
};