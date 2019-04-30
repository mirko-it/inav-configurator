
/**
 *
 Parameter abstraction handler
Usage:
[html]
<div id="parameterList"></div>
<div paramtype="checkbox" class="parameterTemplate" style="display: none;"><input type="checkbox" class="parameterElement"><label class="parameterLabel"></label></div>
<div paramtype="text" class="parameterTemplate" style="display: none;"><label class="parameterLabel"></label><input type="text" class="parameterElement"></div>
<div paramtype="number" class="parameterTemplate" style="display: none;"><label class="parameterLabel"></label><input type="number" class="parameterElement"></div>
<div paramtype="select" class="parameterTemplate" style="display: none;"><label class="parameterLabel"></label><select class="parameterElement"></select></div>
[js]
var list = $("#parameterList").empty();
var parameter1 = new createParameter({ id: "param1", type: "checkbox", label: "Parameter1" }, list).setValue(true).show();
var parameter2 = new createParameter({ id: "param2", type: "text", label: "Parameter2" }, list).setValue("test").show();
var parameter3 = new createParameter({ id: "param3", type: "select", label: "Parameter3", options: {'red':'Red','blue':'Blue','green':'Green'} }, list).setValue('blue').show();
var parameter3 = new createParameter({ id: "param3", type: "select", label: "Parameter3", options: { 'red': 'Red', 'blue': 'Blue', 'green': 'Green', 'yellow': 'Yellow' } }, list).setValue('blue').show();
var parameter3 = new createParameter({ id: "param3", type: "select", label: "Parameter3", options: [ { val: 'red', text: 'Red' }, { val: 'blue', text: 'Blue' }, { val: 'green', text: 'Green' }, { val: 'yellow', text: 'Yellow' } ] }, list).setValue('blue').show();
var parameter5 = new createParameter({ id: "param5", type: "number", label: "Parameter5", min: 10, max: 100, value: 50 }, list).show();
console.log(parameter2.getValue());
//parameter.getLabelElement(); // access the label $element
//parameter.getFormElement(); // access the form $element
 */
function createParameter(args, container) {
	var _this_ = this;

	_this_.args = args;
	_this_.param = $(".parameterTemplate[paramtype='" + args.type + "']").clone().removeClass("parameterTemplate").appendTo(container);

	this.getElement = function() {
		return _this_.param;
	}

	this.getValue = function() {
		if ($("input", _this_.param).attr("type") == "checkbox") {
			return $("input", _this_.param).is(':checked');
		} else if ($("input", _this_.param).attr("type") == "text") {
			return $("input", _this_.param).val();
		} else if ($("input", _this_.param).attr("type") == "number") {
			return Number($("input", _this_.param).val());
		} else if ($("select", _this_.param).length) {
			return $("select", _this_.param).val();
		}
		return null;
	}

	this.setValue = function(value) {
		if ($("input", _this_.param).attr("type") == "checkbox") {
			$("input", _this_.param).prop('checked', value);
		} else if (($("input", _this_.param).attr("type") == "text") || ($("input", _this_.param).attr("type") == "number")) {
			$("input", _this_.param).val(value);
		} else if ($("select", _this_.param).length) {
			$("select", _this_.param).val(value);
		}
		return _this_;
	}

	if ($("input", _this_.param).attr("type") == "number") {
		if (typeof(args.min) != "undefined") $(".parameterElement", _this_.param).attr("min", args.min);
		if (typeof(args.max) != "undefined") $(".parameterElement", _this_.param).attr("max", args.max);
		if (typeof(args.step) != "undefined") $(".parameterElement", _this_.param).attr("step", args.step);
	} else if ($("select", _this_.param).length && args.options) {
		var select = $("select", _this_.param);
		var options = select.prop('options');
		$('option', select).remove();
		if ($.isArray(args.options)) {
			for (var i = 0; i < args.options.length; i++) {
				options[options.length] = new Option(args.options[i].text, args.options[i].val);
			};
		} else {
			$.each(args.options, function(val, text) {
				options[options.length] = new Option(text, val);
			});
		}
	}

	if (args.id) {
		$(".parameterLabel", _this_.param).attr("for", args.id);
		$(".parameterElement", _this_.param).attr("id", args.id);
	}
	if (args.label) {
		$(".parameterLabel", _this_.param).text(args.label);
	}
	if (args.value) {
		_this_.setValue(args.value);
	}

	this.show = function() {
		_this_.param.show();
		return _this_;
	}

	this.hide = function() {
		_this_.param.hide();
		return _this_;
	}

	this.getFormElement = function() {
		return $(".parameterElement", _this_.param);
	}

	this.getLabelElement = function() {
		return $(".parameterLabel", _this_.param);
	}

	_this_.param.data("objCreateParameter", _this_);
	return _this_;
}
