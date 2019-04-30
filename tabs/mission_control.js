/*

add backup (+restore) to change action and modify values

delete action list window from main (cloned)


*/
'use strict';
var fb = console.log;

TABS.mission_control = {};
TABS.mission_control.isYmapLoad = false;
TABS.mission_control.initialize = function (callback) {

    if (GUI.active_tab != 'mission_control') {
        GUI.active_tab = 'mission_control';
        googleAnalytics.sendAppView('Mission Control');
    }

    if (CONFIGURATOR.connectionValid) {
        var loadChainer = new MSPChainerClass();
        loadChainer.setChain([
            mspHelper.getMissionInfo
        ]);
        loadChainer.setExitPoint(loadHtml);
        loadChainer.execute();
    } else {

        // FC not connected, load page anyway
        loadHtml();
    }

    function updateTotalInfo() {
        if (CONFIGURATOR.connectionValid) {
            $('#availablePoints').text(MISSION_PLANER.countBusyPoints + '/' + MISSION_PLANER.maxWaypoints);
            $('#missionValid').html(MISSION_PLANER.isValidMission ? chrome.i18n.getMessage('armingCheckPass') : chrome.i18n.getMessage('armingCheckFail'));
        }
    }

    function loadHtml() {
        $('#content').load("./tabs/mission_control.html", process_html);
    }

    function process_html() {

        // set GUI for offline operations
        if (!CONFIGURATOR.connectionValid) {
            $('#infoAvailablePoints').hide();
            $('#infoMissionValid').hide();
            $('#loadMissionButton').hide();
            $('#saveMissionButton').hide();
            $('#loadEepromMissionButton').hide();
            $('#saveEepromMissionButton').hide();
        }

        if (typeof require !== "undefined") {
            loadSettings();
            // let the dom load finish, avoiding the resizing of the map
            setTimeout(initMap, 200);
        } else {
            $('#missionMap, #missionControls').hide();
            $('#notLoadMap').show();
        }
        localize();


        $('#removeAllPoints').on('click', function () {
            if (points.length && confirm(chrome.i18n.getMessage('confirm_delete_all_points'))) {
                removeAllPoints();
            }
        });

        $('#savePoint').on('click', function () {
            if (selectedPoint) {
                selectedPoint.backup_ = null; delete selectedPoint.backup_;
                savePointEditForm(selectedPoint);
                refreshPointsGrid();
                drawMarkers();
            }
        });

        $('#restorePoint').on('click', function () {
            if (selectedPoint && selectedPoint.backup_) {
                clonePoint(selectedPoint.backup_, selectedPoint);
                selectedPoint.backup_ = null; delete selectedPoint.backup_;
                showPointEditForm(selectedPoint);
                refreshPointsGrid();
                drawMarkers();
            }
        });

        $('#removePoint').on('click', function () {
            if (selectedPoint) {
                removePoint(selectedPoint);
            }
        });

        $('#loadFileMissionButton').on('click', function () {
            if (points.length && !confirm(chrome.i18n.getMessage('confirm_delete_all_points'))) return;
            removeAllPoints();
            var dialog = require('nw-dialog');
            dialog.setContext(document);
            dialog.openFileDialog(function(result) {
                loadMissionFile(result);
            })
        });

        $('#saveFileMissionButton').on('click', function () {
            //if (!points.length) return;
            var dialog = require('nw-dialog');
            dialog.setContext(document);
            dialog.saveFileDialog('', '.mission', function(result) {
                saveMissionFile(result);
            })
        });

        $('#loadMissionButton').on('click', function () {
            if (points.length && !confirm(chrome.i18n.getMessage('confirm_delete_all_points'))) return;
            removeAllPoints();
            $(this).addClass('disabled');
            GUI.log('Start get point');
            pointForSend = 0;
            getNextPoint();
        });

        $('#saveMissionButton').on('click', function () {
            $(this).addClass('disabled');
            GUI.log('Start send point');
            pointForSend = 0;
            sendNextPoint();
        });

        $('#loadEepromMissionButton').on('click', function () {
            if (points.length && !confirm(chrome.i18n.getMessage('confirm_delete_all_points'))) return;
            removeAllPoints();
            GUI.log(chrome.i18n.getMessage('eeprom_load_ok'));
            MSP.send_message(MSPCodes.MSP_WP_MISSION_LOAD, [0], getPointsFromEprom);
        });
        $('#saveEepromMissionButton').on('click', function () {
            GUI.log(chrome.i18n.getMessage('eeprom_saved_ok'));
            MSP.send_message(MSPCodes.MSP_WP_MISSION_SAVE, [0], false);
        });

        $('#saveSettings').on('click', function () {
            settings = { speed: $('#MPdefaultPointSpeed').val(), alt: $('#MPdefaultPointAlt').val() };
            saveSettings();
            closeSettingsPanel();
        });

        $('#cancelSettings').on('click', function () {
            loadSettings();
            closeSettingsPanel();
        });

        $("#MPeditPoint .buttonCloseBox").on("click", function() {
            unselectPoint();
            closePointEditForm();
            drawMarkers();
        });

        updateTotalInfo();


        $gridPoints = $("#missionActionList tbody");

        $("#missionActionListPlaceholder").droppable({
            accept: "#missionActionList.detached",
            tolerance: "pointer",
            drop: function(event, ui) {
                attachMissionActionList(true);

            }
        });

        $("#missionActionListPlaceholder").on("dblclick", function(event) {
            attachMissionActionList(true);
        });
        $("#missionActionList").on("dblclick", ".gui_box_titlebar", function(event) {
            toggleMissionActionListAttached();
        });

        $("#missionActionList tbody").sortable({
            handle: "td:first-child",
            stop: function(event, ui) {
                updatePointListFromGrid();
            }
        });

        $("#missionActionList").on("click", "tr.rowPoint", function(event) {
            if ($(event.target).closest("td").hasClass("actions")) return;
            clearPointEditForm();
            selectPoint($(this).data("point"));
            drawMarkers();
        });

        $("#missionActionList").on("click", "td.actions span.delete", function(event) {
            removePoint($(this).closest("tr").data("point"));
        });

        $("#missionActionList .buttonCollapse").on("click", function() {
            let attached = $("#missionActionList").hasClass("attached");
            let collapsed = $("#missionActionList").hasClass("collapsed");
            if (!attached && !collapsed) {
                attachMissionActionList(true);
            } else {
                toggleMissionActionListCollapsed();
            }
        });

        $("#missionActionList .buttonDetach").on("click", function() {
            toggleMissionActionListAttached();
        });

        GUI.content_ready(callback);

/* * /
// TESTING MSP SEND MESSAGE
if (!CONFIGURATOR.connectionValid) {
    $('#loadMissionButton').removeClass('disabled'); $('#saveMissionButton').removeClass('disabled');
    $('#loadEepromMissionButton').removeClass('disabled'); $('#saveEepromMissionButton').removeClass('disabled');
    MISSION_PLANER = { bufferPoint: {} };
    MSP.send_message = function (code, data, callback_sent, callback_msp, protocolVersion) {
        var codeName = null; $.each(MSPCodes, function(name, value) { if (code == value) codeName = name; });
        console.log((codeName ? codeName : code), data);
        if (callback_sent) setTimeout(callback_sent, 100);
        if (callback_msp) setTimeout(callback_msp, 200);
    }
}
/* */

    }

    var map;
    var points = [];
    var markers = [];
    var lines = [];
    var $gridPoints = null;
    var selectedPoint = null;
    var editMissionPointsParameterWpType = null;
    var editMissionPointsGroupType = [];
    var editMissionPointsParameters = [];
    var pointForSend = 0;
    var settings = { speed: 0, alt: 5000 };

    function loadSettings() {
        chrome.storage.local.get('missionPlanerSettings', function (result) {
            if (result.missionPlanerSettings) {
                settings = result.missionPlanerSettings;
            }

            refreshSettings();
        });
    }

    function saveSettings() {
        chrome.storage.local.set({'missionPlanerSettings': settings});
    }

    function refreshSettings() {
        $('#MPdefaultPointAlt').val(settings.alt);
        $('#MPdefaultPointSpeed').val(settings.speed);
    }


    function showPointEditForm(point) {
        updatePointEditForm(point);

        setTimeout(function() {
            if ($('#MPeditPoint').is(":visible")) {
                $('#MPeditPoint').hide().fadeIn(100);
            } else {
                $('#MPeditPoint').slideDown();
            }
        }, 10);
    }

    function closePointEditForm() {
        clearPointEditForm();
        $('#MPeditPoint').slideUp();
    }

    function clearPointEditForm() {
        $.each(MWNP.WPTYPE, function(name, wpType) {
            if (editMissionPointsParameters && editMissionPointsParameters[wpType]) {
                $.each(MWNP.WPTYPE, function(name, argType) {
                    if (editMissionPointsParameters[wpType][argType]) {
                        editMissionPointsParameters[wpType][argType].setValue(null);
                    }
                });
            }
        });
    }

    function getRecursiveValue(obj, props) {
        if ($.isArray(props)) {
            if (props.length > 1) {
                return getRecursiveValue(obj[props[0]], props.slice(1));
            } else {
                return obj[props[0]];
            }
        }
        return obj[props];
    }

    function setRecursiveValue(obj, value, props) {
        if ($.isArray(props)) {
            if (props.length > 1) {
                setRecursiveValue(obj[props[0]], value, props.slice(1));
            } else {
                obj[props[0]] = value;
            }
        }
        obj[props] = value;
    }

    function deleteRecursiveValue(obj, props) {
        if ($.isArray(props)) {
            if (props.length > 1) {
                deleteRecursiveValue(obj[props[0]], props.slice(1));
            } else {
                delete obj[props[0]];
            }
        }
        delete obj[props];
    }

    function getArgumentsFromAction(action) {
        for (var i = 0; i < MWNP.WP_ARG_MAP.length; i++) {
            if (MWNP.WP_ARG_MAP[i].wptype == action)
                return MWNP.WP_ARG_MAP[i].args;
        }
        return null;
    }


	// compare old and new action, remove uncompatible values, add new ones
	function changePointAction(point, newAction) {
		var argsOld = [], argsNew = [];
		$.each(getArgumentsFromAction(point.action), function(i, argType) { argsOld[argType.argtype] = argType; });
		$.each(getArgumentsFromAction(newAction), function(i, argType) { argsNew[argType.argtype] = argType; });
		$.each(MWNP.ARGTYPE, function(name, argType) {
			if (argsOld[argType] && argsOld[argType].params) {
				if (argsNew[argType] && argsNew[argType].params) {
					if ((argsOld[argType].params.type === argsNew[argType].params.type) && (argsOld[argType].params.label === argsNew[argType].params.label)) {
						//console.log(argsOld[argType].params.label + " (" + argsOld[argType].params.obj + ") stays");
					} else {
						//console.log(argsOld[argType].params.label + " (" + argsOld[argType].params.obj + ") changes to " + argsNew[argType].params.label + " (" + argsNew[argType].params.obj + ")");
						if (typeof(argsNew[argType].params.value) != "undefined") {
							setRecursiveValue(point, argsNew[argType].params.value, argsNew[argType].params.obj);
						} else {
							deleteRecursiveValue(point, argsOld[argType].params.obj);
						}
					}
				} else {
					//console.log(argsOld[argType].params.label + " (" + argsOld[argType].params.obj + ") goes away");
					deleteRecursiveValue(point, argsOld[argType].params.obj);
				}
			} else if (argsNew[argType] && argsNew[argType].params) {
				//console.log(argsNew[argType].params.label + " (" + argsNew[argType].params.obj + ") comes");
				if (typeof(argsNew[argType].params.value) != "undefined") setRecursiveValue(point, argsNew[argType].params.value, argsNew[argType].params.obj);
			}
		});
		point.action = newAction;
		return point;
	}


    function updatePointEditForm(point) {
        clearPointEditForm();
        if (!editMissionPointsParameterWpType) {
            editMissionPointsParameterWpType = new createParameter({
                id: "wpType",
                type: "select",
                label: "Type",
                options: [
                    { val: MWNP.WPTYPE.WAYPOINT, text: 'Waypoint' },
                    { val: MWNP.WPTYPE.PH_UNLIM, text: 'Unlimited PosHold' },
                    { val: MWNP.WPTYPE.PH_TIME, text: 'Timed PosHold' },
                    { val: MWNP.WPTYPE.RTH, text: 'Return to Home' },
                    { val: MWNP.WPTYPE.SET_POI, text: 'Set POI' },
                    { val: MWNP.WPTYPE.JUMP, text: 'Jump to WP' },
                    { val: MWNP.WPTYPE.SET_HEAD, text: 'Set heading' },
                    { val: MWNP.WPTYPE.LAND, text: 'Land' }
                ]
            }, $("#pointParameterList")).setValue(MWNP.WPTYPE.WAYPOINT).show();

			editMissionPointsParameterWpType.getElement().on("change", function(evt) {
				let newAction = parseInt($(this).data("objCreateParameter").getValue());
				changePointAction(selectedPoint, newAction);
				updatePointEditForm(selectedPoint);
			});
        }

        editMissionPointsParameterWpType.setValue(point.action);

        $("#pointParameterList div.editMissionPointsGroupType").hide();

		let argsPoint = getArgumentsFromAction(point.action);

        // draw parameters group
        if (!editMissionPointsGroupType[point.action]) {
            editMissionPointsGroupType[point.action] = $('<div class="editMissionPointsGroupType">').attr("WPType", point.action).appendTo($("#pointParameterList"));
            editMissionPointsParameters[point.action] = [];
			$.each(argsPoint, function(i, argType) {
                var argsCreate = {
                    id: ("editPoint_" + point.action + "_" + argType.argtype),
                    type: argType.params.type,
                    label: (argType.params.label + (argType.params.unit ? (" (" + argType.params.unit + ")") : "") + ": ")
                };
                if (typeof(argType.params.value) != "undefined") argsCreate.value = argType.params.value;
                if (typeof(argType.params.min) != "undefined") argsCreate.min = argType.params.min;
                if (typeof(argType.params.max) != "undefined") argsCreate.max = argType.params.max;
                if (typeof(argType.params.step) != "undefined") argsCreate.step = argType.params.step;
                editMissionPointsParameters[point.action][argType.argtype] = new createParameter(argsCreate, editMissionPointsGroupType[point.action]).show();
            });
        }

        // set parameters values
		$.each(argsPoint, function(i, argType) {
            editMissionPointsParameters[point.action][argType.argtype].setValue(getRecursiveValue(point, argType.params.obj));
        });

        editMissionPointsGroupType[point.action].show();
    }


    function savePointEditForm(point) {
        // get parameters values
        let argsPoint = getArgumentsFromAction(selectedPoint.action);
        $.each(argsPoint, function(i, argType) {
            let value = editMissionPointsParameters[selectedPoint.action][argType.argtype].getValue();
            if (typeof(argType.params.convert) == "function") value = argType.params.convert(value);
            setRecursiveValue(selectedPoint, value, argType.params.obj);
        });

        updatePointEditForm(selectedPoint);
        refreshPointsGrid();
        updateTotalInfo();
        drawMarkers();
    }


    function drawMarkers() {
        for (var i = 0; i < markers.length; i++) {
            map.removeLayer(markers[i]);
        }
        markers = [];

        drawMissionPathLines();

        for (var i = 0; i < points.length; i++) {
            if ([ MWNP.WPTYPE.WAYPOINT, MWNP.WPTYPE.PH_UNLIM, MWNP.WPTYPE.PH_TIME, MWNP.WPTYPE.SET_POI, MWNP.WPTYPE.LAND ].includes(points[i].action)) {
                points[i].marker = addMarker(points[i], { zIndex: 1 });
                points[i].marker.pointParameters = points[i];
            } else if ((points[i].action == MWNP.WPTYPE.RTH) && (i > 0)) {
                points[i].marker = addMarker(points[i], { relativeTo: points[i - 1], translate: [18, 8], zIndex: 0 });
                points[i].marker.pointParameters = points[i];
            }
        }
    }

    function drawMissionPathLines(args) {
        var oldPos = null;
        var line = null;
        var missionDistance = 0;
        var newCoords = null;
        var currentPoiCoords = null;

        for (var i = 0; i < lines.length; i++) {
            map.removeLayer(lines[i]);
        }
        lines = [];

        for (var i = 0; i < points.length; i++) {
            if (args && args.useMarkers) {
                newCoords = points[i].marker.getSource().getFeatures()[0].getGeometry().getCoordinates();
            } else {
                newCoords = ol.proj.fromLonLat([points[i].lon, points[i].lat]);
            }

            if ([ MWNP.WPTYPE.WAYPOINT, MWNP.WPTYPE.PH_UNLIM, MWNP.WPTYPE.PH_TIME, MWNP.WPTYPE.LAND ].includes(points[i].action)) {
                if (oldPos) {
                    line = paintPathLine(oldPos, newCoords);
                    missionDistance += ol.Sphere.getLength(line);
                }
                oldPos = newCoords;
                if (currentPoiCoords) {
                    paintPathLine(currentPoiCoords, newCoords, { color: "#d9d92e", lineDash: [1, 10] });
                }
            } else if (points[i].action == MWNP.WPTYPE.SET_POI) {
                currentPoiCoords = newCoords;
            }
        }

        $('#missionDistance').text(missionDistance.toFixed(2));
    }

    function paintPathLine(pos1, pos2, args) {
        var line = new ol.geom.LineString([pos1, pos2]);

        var feature = new ol.Feature({
            geometry: line
        });

        feature.setStyle(new ol.style.Style({
            stroke: new ol.style.Stroke({
                width: 3,
                color: ((args && args.color) ? args.color : '#1497f1'),
                lineDash: ((args && args.lineDash) ? args.lineDash : null)
            })
        }));

        var vectorSource = new ol.source.Vector({
            features: [feature]
        });

        var layer = new ol.layer.Vector({
            source: vectorSource
        });

        map.addLayer(layer);
        lines.push(layer);

        return line;
    }

    function getPointIcon(point) {
        var styleIcon = null, styleText = null;

        var imgName = "blue";
        if ((point.action == MWNP.WPTYPE.PH_UNLIM) || (point.action == MWNP.WPTYPE.PH_TIME)) {
            imgName = "orange";
        } else if (point.action == MWNP.WPTYPE.RTH) {
            imgName = "green";
        } else if (point.action == MWNP.WPTYPE.SET_POI) {
            imgName = "yellow";
        }
        if (selectedPoint && (selectedPoint === point)) imgName = "edit";

        styleIcon = new ol.style.Icon({
            anchor: [0.5, 1],
            opacity: 1,
            scale: 0.5,
            src: ('../images/icons/cf_icon_position_' + imgName + '.png')
        });

        if (point && (typeof(point.index) != "undefined")) {
            styleText = new ol.style.Text({
                text: ("" + parseInt(point.index)),
                offsetX: -1,
                offsetY: -30,
                overflow: true,
                scale: 1.8,
                fill: new ol.style.Fill({ color: 'black' })
            });
        }

        return new ol.style.Style({
            image: styleIcon,
            text: styleText
        });
    }

    function addPoint(point) {
        points.push(point);
        normalizePointList();
        refreshPointsGrid();
        return point;
    }

    function addMarker(point, options) {
        var geometry = null;
        if (options && options.relativeTo) {
            geometry = new ol.geom.Point(ol.proj.fromLonLat([options.relativeTo.lon, options.relativeTo.lat]));
        } else {
            geometry = new ol.geom.Point(ol.proj.fromLonLat([point.lon, point.lat]));
        }
        if (options && options.translate) {
            var pixelcoord = map.getPixelFromCoordinate(geometry.getCoordinates())
            pixelcoord[0] += options.translate[0]; pixelcoord[1] += options.translate[1];
            geometry.setCoordinates(map.getCoordinateFromPixel(pixelcoord));
        }

        var feature = new ol.Feature({
            geometry: geometry
        });

        feature.setStyle(getPointIcon(point));

        var vectorSource = new ol.source.Vector({
            features: [feature]
        });

        var layer = new ol.layer.Vector({
            source: vectorSource
        });

        if (options && options.zIndex) {
            layer.setZIndex(options.zIndex);
        }

        map.addLayer(layer);
        markers.push(layer);

        return layer;
    }

    function selectPoint(point) {
        let isSame = (selectedPoint === point);
        selectedPoint = point;
        if (isSame) {
            updatePointEditForm(selectedPoint);
        } else {
            showPointEditForm(selectedPoint);
        }
        selectPointGrid(selectedPoint);
    }

    function unselectPoint() {
        selectedPoint = null;
        clearPointEditForm();
        unselectPointGrid();
    }


    function initMap() {
        var app = {};

        /**
         * @constructor
         * @extends {ol.control.Control}
         * @param {Object=} opt_options Control options.
         */
        app.PlannerSettingsControl = function (opt_options) {
            var options = opt_options || {};
            var button = document.createElement('button');

            button.innerHTML = ' ';
            button.style = 'background: url(\'../images/CF_settings_white.svg\') no-repeat 1px -1px;background-color: rgba(0,60,136,.5);';

            button.addEventListener('click', openSettingsPanel, false);
            button.addEventListener('touchstart', openSettingsPanel, false);

            var element = document.createElement('div');
            element.className = 'mission-control-settings ol-unselectable ol-control';
            element.appendChild(button);
            element.title = 'MP Settings';

            ol.control.Control.call(this, {
                element: element,
                target: options.target
            });

        };
        ol.inherits(app.PlannerSettingsControl, ol.control.Control);


        /**
         * @constructor
         * @extends {ol.interaction.Pointer}
         */
        app.Drag = function () {

            ol.interaction.Pointer.call(this, {
                handleDownEvent: app.Drag.prototype.handleDownEvent,
                handleDragEvent: app.Drag.prototype.handleDragEvent,
                handleMoveEvent: app.Drag.prototype.handleMoveEvent,
                handleUpEvent: app.Drag.prototype.handleUpEvent
            });

            /**
             * @type {ol.Pixel}
             * @private
             */
            this.coordinate_ = null;

            /**
             * @type {string|undefined}
             * @private
             */
            this.cursor_ = 'pointer';

            /**
             * @type {ol.Feature}
             * @private
             */
            this.feature_ = null;

            /**
             * @type {string|undefined}
             * @private
             */
            this.previousCursor_ = undefined;

            /**
             * @type {obj}
             * @private
             */
            this.point_ = undefined;

        };
        ol.inherits(app.Drag, ol.interaction.Pointer);

        /**
         * @param {ol.MapBrowserEvent} evt Map browser event.
         * @return {boolean} `true` to start the drag sequence.
         */
        app.Drag.prototype.handleDownEvent = function (evt) {
            var mapPixel = evt.map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) { return { feature: feature, layer: layer }; });

            if (mapPixel && mapPixel.feature && mapPixel.layer.pointParameters) {
                this.coordinate_ = evt.coordinate;
                this.feature_ = mapPixel.feature;

                // unselect previously selected point without redraw all layers
                if (selectedPoint && mapPixel.layer && (mapPixel.layer.pointParameters !== selectedPoint)) {
                    for (var i = 0; i < points.length; i++) {
                        if (selectedPoint === points[i]) {
                            unselectPoint();
                            points[i].marker.getSource().getFeatures()[0].setStyle(getPointIcon(points[i]));
                            break;
                        }
                    }
                }

                this.point_ = mapPixel.layer.pointParameters;

                // select actually clicked marker
                selectPoint(mapPixel.layer.pointParameters);
                mapPixel.feature.setStyle(getPointIcon(mapPixel.layer.pointParameters));
            }

            return !!(mapPixel && mapPixel.feature);
        };

        /**
         * @param {ol.MapBrowserEvent} evt Map browser event.
         */
        app.Drag.prototype.handleDragEvent = function (evt) {
            var deltaX = evt.coordinate[0] - this.coordinate_[0];
            var deltaY = evt.coordinate[1] - this.coordinate_[1];

            // cannot move RTH marker
            if (this.point_ && (this.point_.action == MWNP.WPTYPE.RTH)) return;

            /** @type {ol.geom.SimpleGeometry} */
            var geometry = this.feature_.getGeometry();
            geometry.translate(deltaX, deltaY);

            if (this.point_) {
                if (!this.point_.backup_) {
                    this.point_.backup_ = clonePoint(this.point_);
                }
                var coord = roundPoint(ol.proj.toLonLat(geometry.getCoordinates()));
                this.point_.lon = coord[0];
                this.point_.lat = coord[1];

                updatePointEditForm(this.point_);
                refreshPointsGrid();
            }

            this.coordinate_[0] = evt.coordinate[0];
            this.coordinate_[1] = evt.coordinate[1];
            drawMissionPathLines({ useMarkers: true });

            // move RTH marker with previous one
            for (var i = 0; i < points.length; i++) {
                if ((this.point_ === points[i]) && (i < (points.length - 1)) && (points[i + 1].action == MWNP.WPTYPE.RTH)) {
                    var pixelcoord = map.getPixelFromCoordinate(this.point_.marker.getSource().getFeatures()[0].getGeometry().getCoordinates())
                    pixelcoord[0] += 18; pixelcoord[1] += 8;
                    points[i + 1].marker.getSource().getFeatures()[0].getGeometry().setCoordinates(map.getCoordinateFromPixel(pixelcoord));
                }
            }

        };

        /**
         * @param {ol.MapBrowserEvent} evt Event.
         */
        app.Drag.prototype.handleMoveEvent = function (evt) {
            if (this.cursor_) {
                var feature = evt.map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) { return feature; });
                var element = evt.map.getTargetElement();
                if (feature) {
                    if (element.style.cursor != this.cursor_) {
                        this.previousCursor_ = element.style.cursor;
                        element.style.cursor = this.cursor_;
                    }
                } else if (this.previousCursor_ !== undefined) {
                    element.style.cursor = this.previousCursor_;
                    this.previousCursor_ = undefined;
                }
            }
        };

        /**
         * @param {ol.MapBrowserEvent} evt Map browser event.
         * @return {boolean} `false` to stop the drag sequence.
         */
        app.Drag.prototype.handleUpEvent = function (evt) {
            this.coordinate_ = null;
            this.feature_ = null;
            return false;
        };


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

        map = new ol.Map({
            target: document.getElementById('missionMap'),
            layers: [
                new ol.layer.Tile({
                    source: mapLayer
                })
            ],
            controls: ol.control.defaults().extend([
                new app.PlannerSettingsControl()
            ]),
            interactions: ol.interaction.defaults().extend([new app.Drag()]),
            view: new ol.View({
                center: ol.proj.fromLonLat([lon, lat]),
                zoom: 14
            })
        });

        // Set the attribute link to open on an external browser window, so
        // it doesn't interfere with the configurator.
        setTimeout(function() {
            $('.ol-attribution a').attr('target', '_blank');
        }, 100);

        // save map view settings when user moves it
        var currZoom = map.getView().getZoom();
        map.on('moveend', function (evt) {
            chrome.storage.local.set({'missionPlanerLastValues': {
                center: ol.proj.toLonLat(map.getView().getCenter()),
                zoom: map.getView().getZoom()
            }});
            var newZoom = map.getView().getZoom();
            if (currZoom != newZoom) {
                currZoom = newZoom;
                drawMarkers();
            }
        });
        map.on('movestart', function (evt) {
            if (currZoom != map.getView().getZoom()) for (var i = 0; i < points.length; i++) if (points[i].action == MWNP.WPTYPE.RTH) points[i].marker.setVisible(false);
        });

        // load map view settings on startup
        chrome.storage.local.get('missionPlanerLastValues', function (result) {
            if (result.missionPlanerLastValues && result.missionPlanerLastValues.center) {
                map.getView().setCenter(ol.proj.fromLonLat(result.missionPlanerLastValues.center));
                map.getView().setZoom(result.missionPlanerLastValues.zoom);
            }
        });

        // add a new marker by clicking on empty map
        map.on('click', function (evt) {
            var feature = map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) { return feature; });
            if (!feature) {
                var coord = ol.proj.toLonLat(evt.coordinate);
                var point = { action: MWNP.WPTYPE.WAYPOINT, lon: coord[0], lat: coord[1], alt: settings.alt, p1: settings.speed };
                addPoint(point);
                selectPoint(point);
                drawMarkers();
            }
        });

        // change mouse cursor when over marker
        $(map.getViewport()).on('mousemove', function (e) {
            var hit = map.forEachFeatureAtPixel(map.getEventPixel(e.originalEvent), function (feature, layer) { return (feature && layer && layer.pointParameters); });
            map.getTarget().style.cursor = (hit ? 'pointer' : '');
        });

        // handle map size on container resize
        setInterval(function () {
            let width = $("#missionMap canvas").width(), height = $("#missionMap canvas").height();
            if ((map.width_ != width) || (map.height_ != height)) map.updateSize();
            map.width_ = width; map.height_ = height;
        }, 200);

/* * /
// TESTING: load mission file at startup
nw.Window.get().showDevTools(null, function() {
//return;
//    let fileXml = "./examples/131208-0513.mission";
//    let fileXml = "./examples/131227-0505.mission";
//    let fileXml = "./examples/131227-0511.mission";
let fileXml = "./examples/mik.mission";
    loadMissionFile(fileXml);
});
/* */
//loadMissionFile("./examples/mik.mission");
loadMissionFile("./examples/test_rth.mission");
//loadMissionFile("./examples/test_poi.mission");
    }


    function openSettingsPanel() {
        $('#missionPlanerSettings').fadeIn(200);
        $('#missionPlanerTotalInfo, #MPeditPoint').hide();
    }

    function closeSettingsPanel() {
        $('#missionPlanerSettings').hide();
        $('#missionPlanerTotalInfo').fadeIn(200);
        if (selectedPoint !== null) {
            $('#MPeditPoint').fadeIn(200);
        }
    }

    function loadMissionFile(filename) {
        const fs = require('fs-extra');
        const xml2js = require('xml2js');

        fs.readFile(filename, (err, data) => {
            if (err) {
                GUI.log('<span style="color: red">Error reading file</span>');
                return console.error(err);
            }

            xml2js.Parser({ 'explicitChildren': true, 'preserveChildrenOrder': true }).parseString(data, (err, result) => {
                if (err) {
                    GUI.log('<span style="color: red">Error parsing file</span>');
                    return console.error(err);
                }

                // parse mission file
                var mission = { points: [] };
                var node = null;
                var nodemission = null;
                for (var noderoot in result) {
                    if (!nodemission && noderoot.match(/mission/i)) {
                        nodemission = result[noderoot];
                        if (nodemission.$$ && nodemission.$$.length) {
                            for (var i = 0; i < nodemission.$$.length; i++) {
                                node = nodemission.$$[i];
                                if (node['#name'].match(/version/i) && node.$) {
                                    for (var attr in node.$) {
                                        if (attr.match(/value/i)) {
                                            mission.version = node.$[attr]
                                        }
                                    }
                                } else if (node['#name'].match(/mwp/i) && node.$) {
                                    mission.center = {};
                                    for (var attr in node.$) {
                                        if (attr.match(/zoom/i)) {
                                            mission.center.zoom = parseInt(node.$[attr]);
                                        } else if (attr.match(/cx/i)) {
                                            mission.center.lon = parseFloat(node.$[attr]);
                                        } else if (attr.match(/cy/i)) {
                                            mission.center.lat = parseFloat(node.$[attr]);
                                        }
                                    }
                                } else if (node['#name'].match(/missionitem/i) && node.$) {
                                    var point = {};
                                    for (var attr in node.$) {
                                        if (attr.match(/no/i)) {
                                            point.index = parseInt(node.$[attr]);
                                        } else if (attr.match(/action/i)) {
                                            if (node.$[attr].match(/WAYPOINT/i)) {
                                                point.action = MWNP.WPTYPE.WAYPOINT;
                                            } else if (node.$[attr].match(/PH_UNLIM/i) || node.$[attr].match(/POSHOLD_UNLIM/i)) {
                                                point.action = MWNP.WPTYPE.PH_UNLIM;
                                            } else if (node.$[attr].match(/PH_TIME/i) || node.$[attr].match(/POSHOLD_TIME/i)) {
                                                point.action = MWNP.WPTYPE.PH_TIME;
                                            } else if (node.$[attr].match(/RTH/i)) {
                                                point.action = MWNP.WPTYPE.RTH;
                                            } else if (node.$[attr].match(/SET_POI/i)) {
                                                point.action = MWNP.WPTYPE.SET_POI;
                                            } else if (node.$[attr].match(/JUMP/i)) {
                                                point.action = MWNP.WPTYPE.JUMP;
                                            } else if (node.$[attr].match(/SET_HEAD/i)) {
                                                point.action = MWNP.WPTYPE.SET_HEAD;
                                            } else if (node.$[attr].match(/LAND/i)) {
                                                point.action = MWNP.WPTYPE.LAND;
                                            } else {
                                                point.action = 0;
                                            }
                                        } else if (attr.match(/lat/i)) {
                                            point.lat = parseFloat(node.$[attr]);
                                        } else if (attr.match(/lon/i)) {
                                            point.lon = parseFloat(node.$[attr]);
                                        } else if (attr.match(/alt/i)) {
                                            point.alt = (parseInt(node.$[attr]) * 100);
                                        } else if (attr.match(/parameter1/i)) {
                                            point.p1 = parseInt(node.$[attr]);
                                        } else if (attr.match(/parameter2/i)) {
                                            point.p2 = parseInt(node.$[attr]);
                                        } else if (attr.match(/parameter3/i)) {
                                            point.p3 = parseInt(node.$[attr]);
                                        }
                                    }
                                    mission.points.push(point);
                                }
                            }
                        }
                    }
                }

                // draw actual mission
                removeAllPoints();
                for (var i = 0; i < mission.points.length; i++) {
                    if (MWNP.supportedWPTypes.includes(mission.points[i].action)) {
                        addPoint(mission.points[i]);
                        if (i == 0) {
                            var coord = ol.proj.fromLonLat([mission.points[i].lon, mission.points[i].lat]);
                            map.getView().setCenter(coord);
                            map.getView().setZoom(16);
                        }
                    }
                }
                if (mission.center) {
                    var coord = ol.proj.fromLonLat([mission.center.lon, mission.center.lat]);
                    map.getView().setCenter(coord);
                    if (mission.center.zoom) map.getView().setZoom(mission.center.zoom);
                }
                updateTotalInfo();
                drawMarkers();
            });

        });
    }

    function saveMissionFile(filename) {
        const fs = require('fs-extra');
        const xml2js = require('xml2js');

        var center = roundPoint(ol.proj.toLonLat(map.getView().getCenter()));
        var zoom = map.getView().getZoom();

        var data = {
            'version': { $: { 'value': '2.3-pre8' } },
            'mwp': { $: { 'cx': center[0], 'cy': center[1], 'zoom': zoom } },
            'missionitem': []
        };

        for (var i = 0; i < points.length; i++) {
            var actionName = null; $.each(MWNP.WPTYPE, function(name, value) { if (points[i].action == value) actionName = name; });
            var point = { $: {
                'no': (i + 1),
                'action': actionName,
                'lon': (points[i].lon ? roundPoint(points[i].lon) : 0),
                'lat': (points[i].lat ? roundPoint(points[i].lat) : 0),
                'alt': (points[i].alt ? (points[i].alt / 100) : 0),
                'parameter1': (points[i].p1 ? parseInt(points[i].p1) : 0),
                'parameter2': (points[i].p2 ? parseInt(points[i].p2) : 0),
                'parameter3': (points[i].p3 ? parseInt(points[i].p3) : 0)
            } };
            data.missionitem.push(point);
        }

        var builder = new xml2js.Builder({ 'rootName': 'mission', 'renderOpts': { 'pretty': true, 'indent': '\t', 'newline': '\n' } });
        var xml = builder.buildObject(data);
        fs.writeFile(filename, xml, (err) => {
            if (err) {
                GUI.log('<span style="color: red">Error writing file</span>');
                return console.error(err);
            }
            GUI.log('File saved');
        });
    }


    function removeAllPoints() {
        points = [];
        updateTotalInfo();
        unselectPoint();
        closePointEditForm();
        clearPointsGrid();
        drawMarkers();
    }

    function removePoint(point) {
        for (var i = 0; i < points.length; i++) {
            if (points[i] == point) {
                points.splice(i, 1);
                break;
            }
        }
        normalizePointList();
        refreshPointsGrid();
        updateTotalInfo();
        unselectPoint();
        closePointEditForm();
        drawMarkers();
    }

    function roundPoint(point) {
        if (point && (typeof(point) == "object")) {
            if (point && $.isArray(point) && (point.length > 1) && point[0] && point[1]) {
                point[0] = (Math.round(point[0] * 10000000) / 10000000); point[1] = (Math.round(point[1] * 10000000) / 10000000);
            } else if (point && point.lon && point.lat) {
                point.lon = (Math.round(point.lon * 10000000) / 10000000); point.lat = (Math.round(point.lat * 10000000) / 10000000);
            }
        } else if (point && (typeof(point) == "number")) {
            point = (Math.round(point * 10000000) / 10000000);
        }
        return point;
    }

    function normalizePointList() {
        for (var i = 0; i < points.length; i++) {
            points[i].index = i + 1;
            roundPoint(points[i]);
        }
    }


    function attachMissionActionList(attach) {
        $("#missionActionList").toggleClass("detached", !attach).toggleClass("attached", !!attach);
        $("#missionActionList .gui_box_titlebar").toggleClass("detached", !attach).toggleClass("attached", !!attach);
        $("#missionActionListPlaceholder").toggleClass("detached", !attach).toggleClass("attached", !!attach);
        $("#missionActionList .buttonDetach span.ui-icon").toggleClass("ui-icon-pin-w", !attach).toggleClass("ui-icon-pin-s", !!attach);
        if (attach) {
            $("#missionActionList").css("position", "static");
            $("#missionActionList").appendTo("#missionActionListPlaceholder");
        } else {
            $("#missionActionList").appendTo("#main-wrapper");
            //$("#missionActionList").offset($("#missionActionListPlaceholder").offset());
            $("#missionActionList").offset({ top: (($(window).height() - $("#missionActionList").height()) / 2), left: (($(window).width() - $("#missionActionList").width()) / 2) });

            $("#missionActionList.detached").draggable({
                handle: ".gui_box_titlebar.detached",
                start: function(event, ui) {
                    attachMissionActionList(false);
                }
            });
        }
    }

    function toggleMissionActionListAttached() {
        let attached = $("#missionActionList").hasClass("attached");
        attachMissionActionList(!attached);
    }

    function collapseMissionActionList(collapse) {
        $("#missionActionList .buttonCollapse span.ui-icon").toggleClass("ui-icon-caret-1-s", collapse).toggleClass("ui-icon-caret-1-n", !collapse);
        $("#missionActionList").toggleClass("collapsed", collapse);
    }

    function toggleMissionActionListCollapsed() {
        let collapsed = $("#missionActionList").hasClass("collapsed");
        collapseMissionActionList(!collapsed);
    }

    function clonePoint(src, dst) {
        dst = dst || {};
        for (var n in src) {
            if (["action", "lat", "lon", "alt", "p1", "p2", "p3"].includes(n)) dst[n] = src[n];
        }
        return dst;
    }

    /* * /
    function pointFactory() {
        return {
            index: null,
            action: 1,
            lat: 0,
            lon: 0,
            alt: 0,
            p1: null,
            p2: null,
            p3: null
        };
    }

    function getNewPoint() {
        var point = pointFactory();
        point.action = 1;
        point.lat = roundPoint(41.123456 + 0.01 - (Math.random() * 2 * 0.01));
        point.lon = roundPoint(12.123456 + 0.01 - (Math.random() * 2 * 0.01));
        point.alt = Math.round(Math.random() * 15000);
        point.p1 = null;
        point.p2 = null;
        point.p3 = null;
point.p3 = points.length + 1;
        return point;
    }

    function addPointToList(point) {
        if (!point) point = getNewPoint();
        points.push(point);
        normalizePointList();
        fb(point);
        return point;
    }
    /* */

    function addPointsGridRow(point, container) {
        if (!point) return null;
        var param = $("tr.rowPointTemplate").clone().removeClass("rowPointTemplate").addClass("rowPoint").appendTo(container);
        if (point.backup_) param.addClass("modified");
        $("td[pointValue='index']", param).append(point.index ? point.index : "?");
        var actionName = "?";
        $.each(MWNP.WPTYPE, function(name, wpType) {
            if (point.action == wpType) actionName = name;
        });
        $("td[pointValue='action']", param).text(actionName);
        $("td[pointValue='lon']", param).text(point.lon ? roundPoint(point.lon) : "-");
        $("td[pointValue='lat']", param).text(point.lat ? roundPoint(point.lat) : "-");
        $("td[pointValue='alt']", param).text(point.alt ? (Math.round(point.alt * .1) / 10) : "-");

        let argsPoint = getArgumentsFromAction(point.action);
        $.each(argsPoint, function(i, argType) {
            if ((argType.argtype == MWNP.ARGTYPE.P1) || (argType.argtype == MWNP.ARGTYPE.P2) || (argType.argtype == MWNP.ARGTYPE.P3)) {
                var value = (((typeof(point[argType.params.obj]) != "undefined") && (point[argType.params.obj] != null)) ? point[argType.params.obj] : "-");
                //if (argType.params.type == "checkbox") value = (value ? "Y" : "N");
                $(("td[pointValue='" + argType.params.obj + "']"), param).text(value);
            }
        });

        return param.data("point", point).show();
    }

    function clearPointsGrid() {
        $("tr.rowPoint", $gridPoints).remove();
    }

    function refreshPointsGrid() {
        clearPointsGrid();
        for (var i = 0; i < points.length; i++) {
            addPointsGridRow(points[i], $gridPoints);
        }
        if (selectedPoint) {
            selectPointGrid(selectedPoint);
        }
    }

    function selectPointGrid(point) {
        unselectPointGrid();
        if (!point) return;
        $("#missionActionList tr.rowPoint").each(function(i, t) {
            if ($(t).data("point") === point) {
                $(t).addClass("selected");
            }
        });
    }

    function unselectPointGrid() {
        $("#missionActionList tr.rowPoint").removeClass("selected");
    }

    function updatePointListFromGrid() {
        points = [];
        $("#missionActionList tr.rowPoint").each(function(i, t) {
            points.push($(t).data("point"));
        });
        normalizePointList();
        refreshPointsGrid();
        updateTotalInfo();
        unselectPoint();
        closePointEditForm();
        drawMarkers();
    }


    function getPointsFromEprom() {
        pointForSend = 0;
        MSP.send_message(MSPCodes.MSP_WP_GETINFO, false, false, getNextPoint);
    }

// TODO check
    function getNextPoint() {
        if (MISSION_PLANER.countBusyPoints == 0) {
            endGetPoint();
            return;
        }

        if (pointForSend > 0) {
            var point = {
                action: MISSION_PLANER.bufferPoint.action,
                lon: MISSION_PLANER.bufferPoint.lon,
                lat: MISSION_PLANER.bufferPoint.lat,
                alt: MISSION_PLANER.bufferPoint.alt,
                p1: MISSION_PLANER.bufferPoint.p1,
                p2: MISSION_PLANER.bufferPoint.p2,
                p3: MISSION_PLANER.bufferPoint.p3
            };
            console.log(point);
            addPoint(point);
            if (pointForSend === 1) {
                var coord = ol.proj.fromLonLat([MISSION_PLANER.bufferPoint.lon, MISSION_PLANER.bufferPoint.lat]);
                map.getView().setCenter(coord);
            }
        }

        if (pointForSend >= MISSION_PLANER.countBusyPoints) {
            endGetPoint();
            return;
        }

        MISSION_PLANER.bufferPoint.number = pointForSend;
        pointForSend++;

        MSP.send_message(MSPCodes.MSP_WP, mspHelper.crunch(MSPCodes.MSP_WP), false, getNextPoint);
    }

    function endGetPoint() {
        GUI.log('End get point');
        $('#loadMissionButton').removeClass('disabled');
        updateTotalInfo();
        drawMarkers();
    }


    function sendNextPoint() {
        GUI.log('Sending point ' + (pointForSend + 1) + ' / ' + points.length);

        MISSION_PLANER.bufferPoint.number = pointForSend + 1;
        MISSION_PLANER.bufferPoint.action = points[pointForSend].action;
        MISSION_PLANER.bufferPoint.lon = points[pointForSend].lon;
        MISSION_PLANER.bufferPoint.lat = points[pointForSend].lat;
        MISSION_PLANER.bufferPoint.alt = points[pointForSend].alt;
        MISSION_PLANER.bufferPoint.p1 = points[pointForSend].p1;
        MISSION_PLANER.bufferPoint.p2 = points[pointForSend].p2;
        MISSION_PLANER.bufferPoint.p3 = points[pointForSend].p3;

        pointForSend++;
        if (pointForSend >= points.length) {
            MISSION_PLANER.bufferPoint.endMission = 0xA5;
            MSP.send_message(MSPCodes.MSP_SET_WP, mspHelper.crunch(MSPCodes.MSP_SET_WP), false, endSendPoint);
        } else {
            MISSION_PLANER.bufferPoint.endMission = 0;
            MSP.send_message(MSPCodes.MSP_SET_WP, mspHelper.crunch(MSPCodes.MSP_SET_WP), false, sendNextPoint);
        }
    }

    function endSendPoint() {
        GUI.log('End send point');

        MSP.send_message(MSPCodes.MSP_WP_GETINFO, false, false, updateTotalInfo);

        $('#saveMissionButton').removeClass('disabled');
    }

};

TABS.mission_control.cleanup = function (callback) {
    if (callback) callback();
};



// MultiWii NAV Protocol

var MWNP = MWNP || {};

// WayPoint type
MWNP.WPTYPE = {
    WAYPOINT:     1,
    PH_UNLIM:     2,
    PH_TIME:      3,
    RTH:          4,
    SET_POI:      5,
    JUMP:         6,
    SET_HEAD:     7,
    LAND:         8
};

// Argument type
MWNP.ARGTYPE = {
    LAT:  1,
    LON:  2,
    ALT:  3,
    P1:   4,
    P2:   5,
    P3:   6
};

MWNP.supportedWPTypes = [ MWNP.WPTYPE.WAYPOINT, MWNP.WPTYPE.PH_UNLIM, MWNP.WPTYPE.PH_TIME, MWNP.WPTYPE.RTH, MWNP.WPTYPE.SET_POI, MWNP.WPTYPE.LAND ];
//MWNP.supportedWPTypes = [ MWNP.WPTYPE.WAYPOINT, MWNP.WPTYPE.RTH ];
MWNP.defaultPointArgLat = { type: "text", label: "Lat", value: "0.0", obj: 'lat', convert: function(value) { return (Number(value) || 0); } };
MWNP.defaultPointArgLon = { type: "text", label: "Lon", value: "0.0", obj: 'lon', convert: function(value) { return (Number(value) || 0); } };
MWNP.defaultPointArgAlt = { type: "number", label: "Alt", unit: "cm", obj: 'alt' };

// "WP type has argument" configuration table
MWNP.WP_ARG_MAP = [
    {
        wptype: MWNP.WPTYPE.WAYPOINT,
        args: [
            { argtype: MWNP.ARGTYPE.LAT, params: MWNP.defaultPointArgLat }, { argtype: MWNP.ARGTYPE.LON, params: MWNP.defaultPointArgLon }, { argtype: MWNP.ARGTYPE.ALT, params: MWNP.defaultPointArgAlt },
            { argtype: MWNP.ARGTYPE.P1, params: { type: "number", label: "Speed", unit: "cm/s", min: 0, obj: 'p1' } }
        ]
    }, {
        wptype: MWNP.WPTYPE.PH_UNLIM,
        args: [
            { argtype: MWNP.ARGTYPE.LAT, params: MWNP.defaultPointArgLat }, { argtype: MWNP.ARGTYPE.LON, params: MWNP.defaultPointArgLon }, { argtype: MWNP.ARGTYPE.ALT, params: MWNP.defaultPointArgAlt },
        ]
    }, {
        wptype: MWNP.WPTYPE.PH_TIME,
        args: [
            { argtype: MWNP.ARGTYPE.LAT, params: MWNP.defaultPointArgLat }, { argtype: MWNP.ARGTYPE.LON, params: MWNP.defaultPointArgLon }, { argtype: MWNP.ARGTYPE.ALT, params: MWNP.defaultPointArgAlt },
            { argtype: MWNP.ARGTYPE.P1, params: { type: "number", label: "Hold time", unit: "s", min: 0, value: 0, obj: 'p1' } },
        ]
    }, {
        wptype: MWNP.WPTYPE.RTH,
        args: [
            { argtype: MWNP.ARGTYPE.ALT, params: MWNP.defaultPointArgAlt },
            { argtype: MWNP.ARGTYPE.P1, params: { type: "checkbox", label: "Land", obj: 'p1', convert: function(value) { return (value ? 1 : 0); } } },
        ]
    }, {
        wptype: MWNP.WPTYPE.SET_POI,
        args: [
            { argtype: MWNP.ARGTYPE.LAT, params: MWNP.defaultPointArgLat }, { argtype: MWNP.ARGTYPE.LON, params: MWNP.defaultPointArgLon },
        ]
    }, {
        wptype: MWNP.WPTYPE.JUMP,
        args: [
            { argtype: MWNP.ARGTYPE.P1, params: { type: "number", label: "Waypoint #", min: 0, obj: 'p1' } },
            { argtype: MWNP.ARGTYPE.P2, params: { type: "number", label: "Repeat", min: -1, value: 0, help: "-1 = forever", obj: 'p2' } },
        ]
    }, {
        wptype: MWNP.WPTYPE.SET_HEAD,
        args: [
            { argtype: MWNP.ARGTYPE.P1, params: { type: "number", label: "Head", unit: "°", min: 0, max: 360, value: 0, obj: 'p1' } },
        ]
    }, {
        wptype: MWNP.WPTYPE.LAND,
        args: [
            { argtype: MWNP.ARGTYPE.LAT, params: MWNP.defaultPointArgLat }, { argtype: MWNP.ARGTYPE.LON, params: MWNP.defaultPointArgLon }, { argtype: MWNP.ARGTYPE.ALT, params: MWNP.defaultPointArgAlt },
        ]
    }
];
