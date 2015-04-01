/*!
	SpaceTelescope
	(c) Stuart Lowe and Chris North 2014
*/
/*
	USAGE:
		<script src="js/jquery-1.10.0.min.js" type="text/javascript"></script>
		<script src="js/spacetelescopedesigner.js" type="text/javascript"></script>
		<script type="text/javascript">
		<!--
			$(document).ready(function(){
				spacetel = $.spacetelescopedesigner({});
			});
		// -->
		</script>
*/

if(typeof $==="undefined") $ = {};

(function($) {

	// Make replacement for Math.log10 function (which is considered "experimental"!)
	var G = {};
	G.log10 = function(v) { return Math.log(v)/2.302585092994046; };


	// shim layer with setTimeout fallback
	window.requestAnimFrame = (function(){
		return  window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function( callback ){ window.setTimeout(callback, 1000 / 60); };
	})();

	// Full Screen API - http://johndyer.name/native-fullscreen-javascript-api-plus-jquery-plugin/
	var fullScreenApi = {
		supportsFullScreen: false,
		isFullScreen: function() { return false; },
		requestFullScreen: function() {},
		cancelFullScreen: function() {},
		fullScreenEventName: '',
		prefix: ''
	},
	browserPrefixes = 'webkit moz o ms khtml'.split(' ');
	// check for native support
	if (typeof document.cancelFullScreen != 'undefined') {
		fullScreenApi.supportsFullScreen = true;
	} else {
		// check for fullscreen support by vendor prefix
		for (var i = 0, il = browserPrefixes.length; i < il; i++ ) {
			fullScreenApi.prefix = browserPrefixes[i];
			if (typeof document[fullScreenApi.prefix + 'CancelFullScreen' ] != 'undefined' ) {
				fullScreenApi.supportsFullScreen = true;
				break;
			}
		}
	}
	// update methods to do something useful
	if (fullScreenApi.supportsFullScreen) {
		fullScreenApi.fullScreenEventName = fullScreenApi.prefix + 'fullscreenchange';
		fullScreenApi.isFullScreen = function() {
			switch (this.prefix) {
				case '':
					return document.fullScreen;
				case 'webkit':
					return document.webkitIsFullScreen;
				default:
					return document[this.prefix + 'FullScreen'];
			}
		}
		fullScreenApi.requestFullScreen = function(el) {
			return (this.prefix === '') ? el.requestFullScreen() : el[this.prefix + 'RequestFullScreen']();
		}
		fullScreenApi.cancelFullScreen = function(el) {
			return (this.prefix === '') ? document.cancelFullScreen() : document[this.prefix + 'CancelFullScreen']();
		}
	}
	// jQuery plugin
	if (typeof jQuery != 'undefined') {
		jQuery.fn.requestFullScreen = function() {
			return this.each(function() {
				if (fullScreenApi.supportsFullScreen) fullScreenApi.requestFullScreen(this);
			});
		};
	}
	// export api
	window.fullScreenApi = fullScreenApi;
	// End of Full Screen API

	// Animate Raphael object along a path
	// Adapted from https://github.com/brianblakely/raphael-animate-along/blob/master/raphael-animate-along.js
	Raphael.el.animateAlong = function(path, duration, repetitions, direction, z) {
		var element = this;
		element.zforward = (typeof z!=="boolean") ? false : z;
		element.atFront = false;
		element.path = path;
		element.direction = direction;
		element.pathLen = element.path.getTotalLength();    
		duration = (typeof duration === "undefined") ? 5000 : duration;
		repetitions = (typeof repetitions === "undefined") ? 1 : repetitions;
		element.paper.customAttributes.along = function(v) {
			var a = (this.direction && this.direction < 0) ? (1-v)*this.pathLen : (v * this.pathLen);
			var point = this.path.getPointAtLength(a),
				attrs = { cx: point.x, cy: point.y };
			if(this.zforward){
				if(v > 0.5 && !this.atFront){
					this.toFront();
					this.atFront = true;
				}
				if(v > 0 && v < 0.5 && this.atFront){
					this.toBack();
					this.atFront = false;
				}
			}
			this.rotateWith && (attrs.transform = 'r'+point.alpha);
			return attrs;
		};    
		element.attr({along:0});
		var anim = Raphael.animation({along: 1}, duration);
		element.animate(anim.repeat(repetitions)); 
	};

	// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
	// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating
	// requestAnimationFrame polyfill by Erik Möller
	// fixes from Paul Irish and Tino Zijdel
	(function() {
		var lastTime = 0;
		var vendors = ['ms', 'moz', 'webkit', 'o'];
		for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
			window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
			window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame']
									   || window[vendors[x]+'CancelRequestAnimationFrame'];
		}
	 
		if (!window.requestAnimationFrame)
			window.requestAnimationFrame = function(callback, element) {
				var currTime = new Date().getTime();
				var timeToCall = Math.max(0, 16 - (currTime - lastTime));
				var id = window.setTimeout(function() { callback(currTime + timeToCall); },
				  timeToCall);
				lastTime = currTime + timeToCall;
				return id;
			};
	 
		if (!window.cancelAnimationFrame)
			window.cancelAnimationFrame = function(id) {
				clearTimeout(id);
			};
	}());

	// Get the URL query string and parse it
	$.query = function() {
		var r = {length:0};
		var q = location.search;
		if(q && q != '#'){
			// remove the leading ? and trailing &
			q = q.replace(/^\?/,'').replace(/\&$/,'');
			jQuery.each(q.split('&'), function(){
				var key = this.split('=')[0];
				var val = this.split('=')[1];
				if(/^[0-9\.]+$/.test(val)) val = parseFloat(val);	// convert floats
				r[key] = val;
			});
		}
		return r;
	};

	// Elements with the class "accessible" are intended for people who don't 
	// have Javascript enabled. If we are here they obviously do have Javascript.
	document.write('<style type="text/css">.noscriptmsg { display: none; }</style>');
	
	// Main
	function SpaceTelescope(inp){
	
		// Error checking for jQuery
		if(typeof $!=="function"){ this.log('No jQuery! Abort! Abort!'); return this; }

		// Set some variables
		this.q = $.query();    // Query string
		this.i = inp;          // Input parameters
		this.stage = "intro";  // Current stage - "intro" -> "scenario" -> "designer" -> "launch"
		this.choices = {};     // User's choices
		this.sections = ['objectives','satellite','instruments','cooling','vehicle','site','orbit','proposal'];
		this.keyboard = true;  // Allow keyboard shortcuts (disable in inputs and textareas)
		this.errors = [];      // Holder for errors
		this.warnings = [];    // Holder for warnings
		this.launchstep = 0;

		// Set some URLs
		this.langurl = "config/%LANG%%MODE%.json";
		this.dataurl = "config/options%MODE%.json";
		this.scenariourl = "config/scenarios_%LANG%%MODE%.json";
		
		// Allow keyboard events
		this.keys = new Array();

		// Do we update the address bar?
		this.pushstate = !!(window.history && history.pushState);

		// Default settings
		this.settings = { 'length': 'm', 'currency': 'GBP', 'temperature':'K', 'mass':'kg', 'time': 'years', 'usecookies': false, 'mode': 'normal' };

		this.init(inp);

		// Detect if the CSS transform attribute is available
		var prefixes = 'transform WebkitTransform MozTransform OTransform msTransform'.split(' ');
		this.hastransform=false;
		// Safe for IE8 check of style
		for(var k = 0; k < prefixes.length; k++){
			var div = document.createElement('div');
			if(div.style[prefixes[k]] != undefined) this.hastransform = true;	
		}

		return this;
	}

	SpaceTelescope.prototype.init = function(inp){

		// Language support
		// Set the user's language using the browser settings. Over-ride with query string set value
		this.lang = (typeof this.q.lang==="string") ? this.q.lang : (navigator) ? (navigator.userLanguage||navigator.systemLanguage||navigator.language||browser.language) : "";
		this.langshort = (this.lang.indexOf('-') > 0 ? this.lang.substring(0,this.lang.indexOf('-')) : this.lang.substring(0,2));
		this.langs = (inp && inp.langs) ? inp.langs : { 'en': 'English' };

		// Overwrite defaults with variables passed to the function
		this.setVar("currency","string");
		this.setVar("length","string");
		this.setVar("mass","string");
		this.setVar("temperature","string");
		this.setVar("time","string");
		this.setVar("mode","string");
		this.addEvents();
		this.startup();
		return this;
	}

	SpaceTelescope.prototype.addEvents = function(){

		// Deal with back/forwards navigation. Use popstate or onhashchange (IE) if pushstate doesn't seem to exist
		var _obj = this;
		window[(this.pushstate) ? 'onpopstate' : 'onhashchange'] = function(e){ _obj.navigate(e); };

		// Redefine list variable to be the jQuery DOM object
		list = $('#language ul li a');
		// Add click events to each language in the list
		for(var i = 0; i < list.length; i++) $(list[i]).on('click',{me:this},function(e){ e.preventDefault(); e.data.me.loadLanguage($(this).attr('data'),e.data.me.update); });

		// Make menu toggles active
		$('#summary a').on('click',{me:this},function(e){ e.data.me.toggleMenus('summaryext',e); });
		$('a.togglewarning,a.toggleerror').on('click',{me:this},function(e){ e.preventDefault(); e.data.me.toggleMenus('messages'); });
		$('a.togglemenu').on('click',{me:this},function(e){ e.preventDefault(); e.data.me.toggleMenus('menu'); });
		$('a.togglelang').on('click',{me:this},function(e){ e.preventDefault(); e.data.me.toggleMenus('language'); });


		// Add main menu events
		$('.baritem .save').parent().on('click',{me:this},function(e){ e.data.me.save().toggleMenus(); });
		$('.baritem .help').parent().on('click',{me:this},function(e){ e.data.me.toggleGuide(e).toggleMenus(); });
		$('.baritem .restart').parent().on('click',{me:this},function(e){ e.data.me.toggleMenus(); });
		$('.baritem .options').parent().on('click',{me:this},function(e){ e.data.me.showView('options',e).toggleMenus(); });

		if(fullScreenApi.supportsFullScreen){
			// Add the fullscreen toggle to the menu
			$('#menu ul').append('<li class="baritem" data="fullscreen"><a href="#" class="fullscreenbtn"><img src="images/cleardot.gif" class="icon fullscreen" alt="" /> <span></span></li>');
			// Bind the fullscreen function to the double-click event if the browser supports fullscreen
			$('.baritem .fullscreenbtn').parent().on('click', {me:this}, function(e){ e.data.me.toggleFullScreen().toggleMenus(); });
		}

		// Add events to guide links
		$('body').on('click','a.guidelink',{me:this},function(e){
			if($(this).attr('href').indexOf('#')==0) e.data.me.showView($(this).attr('href').substr(1),e);
			e.data.me;
		});

		// Attach event to keypresses
		$(document).on('keypress',{me:this},function(e){
			if(!e) e = window.event;
			var code = e.keyCode || e.charCode || e.which || 0;
			e.data.me.keypress(code,e);
		});

		// Attach keypress events
		this.registerKey(['?'],function(e){ this.toggleGuide(e); });

		// Make sure the menu stays attached to the menu bar (unless scrolling down)
		$(document).on('scroll',{me:this},function(e){ e.data.me.scrollMenus(); });

		$('.scriptonly').removeClass('scriptonly');

		// Disable keyboard shortcuts when in input fields and textareas
		$(document).on('focus','input,textarea',{me:this},function(e){ e.data.me.keyboard = false; }).on('blur','input,textarea',{me:this},function(e){ e.data.me.keyboard = true; });

		// Build scenarios
		$(document).on('click','#scenarios .button',{me:this},function(e){ e.data.me.chooseScenario($(this).attr('data')); });

		// Close messages when clicking on a link in the message list
		$(document).on('click','#messages a',{me:this},function(e){
			$('#messages').hide();
		});
		
		// Remove instruments
		$(document).on('click','.remove_instrument',{me:this},function(e){
			e.preventDefault();
			e.data.me.removeInstrument($(this).attr('data'));
		});

		// Build cooling options
		$(document).on('change','#designer_cooling .options input,#designer_cooling .options select',{me:this},function(e){
			if(e.data.me.getValue('input[name=hascooling]:checked')=="yes"){
			    $('#designer_cooling li.hascooling').show();
			}
			else $('#designer_cooling li.hascooling').hide();
			e.data.me.parseChoices().showDetails('cooling');
		});

		$(document).on('click','#designer_vehicle .options .button',{me:this},function(e){
			e.preventDefault();
			$('#designer_vehicle .info>li.'+$(this).attr('data')).find('input').trigger('click');
		});
		$(document).on('change','#designer_vehicle .options .selector input',{me:this},function(e){
			$('#designer_vehicle .info>li').removeClass('selected');
			$('#designer_vehicle .info>li.'+$(this).attr('data')).addClass('selected').find('input').trigger('click');
			e.data.me.parseChoices();
		});
		$(document).on('click','#designer_vehicle .options .info>li',{me:this},function(e){
			if(!$(this).hasClass('withinfo')){
				$('.withinfo').removeClass('withinfo');
				$(this).addClass('withinfo');
				$('#designer_vehicle .details').html($(this).find('.vehicle_details').html()).addClass('padded');
			}
		});
		// Build site options
		$(document).on('click','#designer_site .launchsite',{me:this},function(e){
			e.preventDefault();
			$('#designer_site #site').val($(this).attr('data'));
			$('#designer_site #site').trigger('change');
		});
		// Don't submit the forms otherwise we leave the page!
		$(document).on('submit','form',{me:this},function(e){ e.preventDefault(); });
		// Build proposal document holder
		$(document).on('change','.doc input,.doc textarea',{me:this},function(e){ e.data.me.updateProposal(); });
		$(document).on('click','.printable a.button',{me:this},function(e){ e.preventDefault(); e.data.me.printProposal(); });
		$(document).on('click','.relaunch a.button',{me:this},function(e){ e.preventDefault(); e.data.me.relaunch(); });
		$(document).on('click','#launchnav a.button',{me:this},function(e){ e.preventDefault(); e.data.me.launch(); });
		$(document).on('click','.toggler',{me:this},function(e){
			//e.preventDefault();
			var input = $(this).find('input:checked');
			
			if(input.attr('value')=="yes") $(this).addClass('checked');
			else $(this).removeClass('checked');

			if(input.attr('id').indexOf('mode')==0){
				var nmode = (input.attr('value')=="yes" ? "advanced" : "normal");
				if(e.data.me.settings.mode != nmode){
					e.data.me.settings.mode = nmode;
					e.data.me.q.mode = nmode;
					e.data.me.startup();
				}
			}
		});

		// Build the satellite section
		$(document).on('change','#designer_satellite select, #designer_satellite input',{me:this},function(e){
			e.data.me.parseChoices().showDetails('satellite').showDetails('cooling');
		});
		// Build the instruments section
		$(document).on('change','#designer_instruments select',{me:this},function(e){
			var i = e.data.me.getValue('#instruments');
			var w = e.data.me.getValue('#wavelengths');
			e.data.me.parseChoices().showDetails('instruments',{ 'wavelength': w, 'type': i});
			$('.add_instrument.hidden').removeClass('hidden');
		});
		$(document).on('click','#designer_instruments .add_instrument',{me:this},function(e){
			e.preventDefault();
			e.data.me.addInstrument();
		});
		// Build site options
		$(document).on('change','#designer_site #site',{me:this},function(e){
			var site = e.data.me.getValue('#site');
			$('.launchsite').removeClass('selected');
			$('.launchsite[data='+site+']').addClass('selected');
			e.data.me.parseChoices().showDetails('site',site);
		});
		// Build orbit options
		$(document).on('change','#mission_orbit',{me:this},function(e){
			var key = e.data.me.getValue('#mission_orbit');
			e.data.me.highlightOrbit(key).parseChoices().showDetails('orbit',key).showDetails('cooling');
		});
		$(document).on('change','#mission_duration',{me:this},function(e){ e.data.me.parseChoices(); });
		// Add event to form submit for instruments
		$(document).on('submit','#designer_instruments form',{me:this},function(e){ e.preventDefault(); $(this).find('a.add_instrument').trigger('click'); });

		$(window).resize({me:this},function(e){ e.data.me.resize(); });

		return this;
	}

	SpaceTelescope.prototype.startup = function(){

		this.data = null;
		this.phrases = null;
		this.choices = {};
		this.scenarios = null;
		this.buildTable();
		
		this.loadConfig(this.update);
		this.loadLanguage(this.lang,this.update);

		// Build language list
		var list = "";
		var n = 0;
		for(l in this.langs){
			list += '<li class="baritem"><a href="#" title="'+this.langs[l]+'" data="'+l+'">'+this.langs[l]+' ['+l+']</a></li>'
			n++;
		}
		$('#language ul').html(list);
		if(n < 2) $('.togglelang').closest('.baritem').hide();

		return this;
	}

	// Build a toggle button
	// Inputs
	//   a = { "value": "a", "id": "uniqueid_a", "checked": true }
	//   b = { "value": "b", "id": "uniqueid_b", "checked": false }
	SpaceTelescope.prototype.buildToggle = function(id,a,b){

		if(typeof id!=="string" && typeof a != "object" && typeof b != "object") return "";

		if(a.checked) html = '<div class="toggleinput toggler"><label class="toggle-label1" for="'+a.id+'"></label>';
		else html = '<div class="toggleinput toggler checked"><label class="toggle-label1" for="'+a.id+'"></label>';
		html += '<div class="toggle-bg">';
		html += '	<input id="'+a.id+'" type="radio" '+(a.checked ? 'checked="checked" ' : '')+'name="'+id+'" value="'+a.value+'">';
		html += '	<input id="'+b.id+'" type="radio" '+(b.checked ? 'checked="checked" ' : '')+'name="'+id+'" value="'+b.value+'">';
		html += '	<span class="switch"></span>';
		html += '</div>';
		html += '<label class="toggle-label2" for="'+b.id+'"></label></div>';

		return html;
	}

	// Update the text of a toggle input
	// Inputs:
	//   a = { "id": "ID", "value": "value", "label": "The displayed label A" }
	//   b = { "id": "ID", "value": "value", "label": "The displayed label B" }
	//   title = A title
	SpaceTelescope.prototype.updateToggle = function(a,b,title){
		if(typeof a != "object" && typeof b != "object" || $('#'+a.id).length==0 || $('#'+b.id).length==0) return this;
		if(!title) title = "";
		if(!a.label) a.label = "";
		if(!b.label) b.label = "";
		$('#'+a.id+',#'+b.id).attr('title',title);
		$('label[for='+a.id+']').html(a.label);
		$('label[for='+b.id+']').html(b.label);
		return this;
	}
	
	// Build the page structure, adds events and resets values.
	// Called when we've loaded the options.
	SpaceTelescope.prototype.buildPage = function(){

		// Make sure we only call this once
		if(this.built) return this.updatePage();

		this.built = true;

		// Build scenarios
		$('#scenarios').html('<h2></h2><p class="about"></p><ul id="scenariolist"></ul>');

		// Update messages dropdown menu
		$('#messages .warnings').html('<div class="bigpadded"><h3 class="warning"><img src="images/cleardot.gif" class="icon warning" /> <span class="title"></span> <span class="warning value">0</span></h3><ul class="summary"></ul>');
		$('#messages .errors').html('<div class="bigpadded"><h3 class="error"><img src="images/cleardot.gif" class="icon error" /> <span class="title"></span> <span class="error value">0</span></h3><ul class="summary"></ul>');

		// Construct the designer
		$('#designer').html('<div class="designer_inner bigpadded"><div id="main"><div id="menubar"></div><div id="output"></div><div id="sidebar"><div class="padded"></div></div></div></div>');

		// Add containers for each designer section
		for(var i = 0; i < this.sections.length; i++){
			if($('#designer_'+this.sections[i]).length == 0) $('#output').append('<div id="designer_'+this.sections[i]+'" class="designer"><h2 class="designer_title"><a href="#designer_'+this.sections[i]+'" class="toggle'+this.sections[i]+'"></a></h2><div class="designer_content"><div class="intro"></div><div class="options"></div><div class="questions"></div></div></div>');
		}
		$('.barmenu').append('<div class="baritem togglelaunch"><a href="#launch" class="">Launch</a></div>');

		// Build the objectives section
		$('#designer_objectives .intro').after('<div class="summary"></div>');

		// Build the satellite section
		$('#designer_satellite .options').html('<div class="bigpadded"><form><ul><li class="option mirror_diameter"><label for="mirror_size"></label><select id="mirror_size" name="mirror_size"></select></li><li class="option mirror_deployable"><label for="mirror_deployable"></label>'+this.buildToggle("toggledeployable",{ "value": "no", "id": "mirror_deployable_no", "label": "", "checked": true },{ "value": "yes", "id": "mirror_deployable_yes", "label": "" })+'</li><li class="option mirror_uv"><label for="mirror_uv"></label>'+this.buildToggle("toggleuv",{ "value": "no", "id": "mirror_uv_no", "checked": true },{ "value": "yes", "id": "mirror_uv_yes" })+'</li></ul></form><div class="details"></div></div>');

		// Build the instruments section
		$('#designer_instruments .options').html('<div class="bigpadded"><form><ul><li><label for="instruments"></label><select id="wavelengths" name="wavelengths"></select><select id="instruments" name="instruments"></select> <input type="text" id="instrument_name" name="instrument_name" /></li></ul></form><div class="details"></div><a href="#" class="add_instrument hidden"><img src="images/cleardot.gif" class="icon add" /><span>'+this.phrases.designer.instruments.options.add+'</span></a></div><div class="instrument_list bigpadded"></div>');

		// Build cooling options
		$('#designer_cooling .options').html('<div class="bigpadded"><form><ul></ul></form><div class="details"></div></div>');

		// Build site options
		$('#designer_site .options').html('<div class="worldmap"><img src="images/worldmap.jpg" /></div><div class="bigpadded"><form><ul><li><label for="site"></label><select id="site" name="site"></select></li></ul></form><div class="details"></div></div>');

		// Build orbit options
		$('#designer_orbit .options').html('<div id="orbits"></div><div class="bigpadded"><form><ul><li><label for="mission_orbit"></label><select id="mission_orbit" name="mission_orbit"></select></li><li><label for="mission_duration"></label><select id="mission_duration" name="mission_duration"></select></li></ul></form><div class="details"></div></div>');

		// Build proposal document holder
		$('#designer_proposal .options').html('<div class="padded"><div class="doc"></div></div>');

		$('#sidebar').html('<div class="sidebar_inner"><div class="satellite panel"></div><div class="vehicle padded panel"></div><div class="site worldmap panel"></div><div class="orbit panel"></div></div>');

		this.buildTable();

		this.updatePage();

		return this;
	}

	SpaceTelescope.prototype.updatePage = function(){

		var html = '';
		// Build menu item for each designer section
		for(var i = 0; i < this.sections.length; i++) html += '<li><a href="#designer_'+this.sections[i]+'" class="toggle'+this.sections[i]+'"></a></li>';
		$('#menubar').html('<ul>'+html+'</ul>');

		// Update cooling options
		// Remove previous options
		$('#designer_cooling .options form ul li').remove();
		// Add cooling option
		$('#designer_cooling .options form ul').append('<li><label for="hascooling"></label>'+this.buildToggle("hascooling",{ "value": "no", "id": "cooling_no", "checked": true },{ "value": "yes", "id": "cooling_yes" })+'</li>');
		// Add optional others
		if(this.data.cooling.temperature) $('#designer_cooling .options form ul').append('<li class="hascooling"><label for="cooling_temperature"></label><select id="cooling_temperature" name="cooling_temperature"></select></li>');
		if(this.data.cooling.passive) $('#designer_cooling .options form ul').append('<li class="hascooling"><label for="cooling_passive"></label>'+this.buildToggle("cooling_passive",{ "value": "no", "id": "cooling_passive_no"},{ "value": "yes", "id": "cooling_passive_yes","checked": true})+'</li>');
		if(this.data.cooling.active) $('#designer_cooling .options form ul').append('<li class="hascooling"><label for="cooling_active"></label>'+this.buildToggle("cooling_active",{ "value": "no", "id": "cooling_active_no", "checked": true },{ "value": "yes", "id": "cooling_active_yes" })+'</li>');
		if(this.data.cooling.cryogenic) $('#designer_cooling .options form ul').append('<li class="hascooling"><label for="cooling_cryogenic"></label><select id="cooling_cryogenic" name="cooling_cryogenic"></select></li>');

		// Update the launch vehicle section
		html = '<div class="bigpadded">';
		html += '<form><ul class="info">';
		for(var l in this.data.vehicle){
			html += '<li class="'+l+'" data="'+l+'">';
			html += '<div class="image"><img src="" alt="" title="" /></div><div class="operator"><img src="" alt="" title="" /></div>';
			html += '<div class="vehicle_details">';
			html += '<div class="rocket"></div>';
			var rows = ['operator','height','diameter','currency','massLEO','massGTO',(this.data.vehicle[l].risk ? 'risk' : ''),'sites'];
			for(var i = 0 ; i < rows.length; i++) html += this.buildRow('','',rows[i]);
			html += '<div class="clearall"></div>';
			html += '</div>';
			html += '<div class="selector"><input type="radio" name="vehicle_rocket" id="vehicle_rocket_'+l+'" data="'+l+'" /><label for="vehicle_rocket_'+l+'"></label></div>';
			html += '</li>';
		}
		// .details will be used to display the details for the selected vehicle
		html += '</ul></form><div class="details"></div></div>';
		$('#designer_vehicle .options').html(html);

		$('.details').html('').removeClass('padded');
		$('#sidebar .panel').hide();

		return this;
	}

	SpaceTelescope.prototype.buildTable = function(){
		// Barebones summary table
		this.table = {
			'success': {
				'list': {
					'success_vehicle': {},
					'success_site': {},
					'success_orbit': {},
					'success_deploy': {},
					'success_cooling': {},
					'success_instruments': {},
					'success_mission': {}
				}
			},
			'cost_available': {
				'list': {
					'cost_initial': {},
					'cost_dev_total': {
						'list': {
							'cost_dev_satellite': {},
							'cost_dev_mirror': {},
							'cost_dev_cooling': {},
							'cost_dev_instruments': {}
						}
					},
					'cost_operations_total': {
						'list': {
							'cost_operations_launch': {},
							'cost_operations_ground': {}
						}
					},
					'cost_total': {},
					'cost_available': {}
				}
			},
			'mass_total': {
				'list': {
					'mass_satellite': {},
					'mass_mirror': {},
					'mass_cooling_total': (this.settings.mode=="advanced" ? {
						'list': {
							'mass_cooling_passive': {},
							'mass_cooling_cryo': {},
							'mass_cooling_active': {}
						}
					} : {}),
					'mass_instruments': {}
				}
			},
			'time_dev_total': {
				'list': {
					'time_dev_total': {
						'list': {
							'time_dev_satellite': {},
							'time_dev_mirror': {},
							'time_dev_cooling': {},
							'time_dev_instruments': {}
						}
					},
					'time_mission': {},
					'time_cooling': {},
					'time_fuel': {},
					'time_observing': {}
				}
			},
			'science_total': {},
			'profile_total': {
				'list': {
					'profile_site': {},
					'profile_vehicle': {},
					'profile_instruments': {},
					'profile_mirror': {},
					'profile_temperature': {},
					'profile_orbit': {},
					'profile_launch': {},
					'profile_end': {}
				}
			}
		}
	}

	// Called when the display area is resized
	SpaceTelescope.prototype.resize = function(){

		if(this.modal) this.positionModal(this.modal);

		// Update the orbit diagram
		this.resizeSpace();
		
		return this;
	}
	
	// Work out where we are based on the anchor tag
	SpaceTelescope.prototype.navigate = function(e,a){
		if(!a) var a = location.href.split("#")[1];
		this.log('navigate',a,e);
		if(typeof a!=="string") a = "";
		this.showView(a,e);
		return this;
	}

	// Process keypress events
	SpaceTelescope.prototype.keypress = function(charCode,event){
		if(this.keyboard){
			if(!event) event = { altKey: false };
			for(var i = 0 ; i < this.keys.length ; i++){
				if(this.keys[i].charCode == charCode && event.altKey == this.keys[i].altKey){
					this.keys[i].fn.call(this,{event:event});
					break;
				}
			}
		}
	}
	// Register keyboard commands and associated functions
	SpaceTelescope.prototype.registerKey = function(charCode,fn,txt){
		if(typeof fn!="function") return this;
		if(typeof charCode!="object") charCode = [charCode];
		var aok, ch, c, i, alt, str;
		for(c = 0 ; c < charCode.length ; c++){
			alt = false;
			if(typeof charCode[c]=="string"){
				if(charCode[c].indexOf('alt')==0){
					str = charCode[c];
					alt = true;
					charCode[c] = charCode[c].substring(4);
				}else str = charCode[c];
				ch = charCode[c].charCodeAt(0);
			}else{
				ch = charCode[c];
				if(ch==37) str = "&larr;";
				else if(ch==32) str = "space";
				else if(ch==38) str = "up";
				else if(ch==39) str = "&rarr;";
				else if(ch==40) str = "down";
				else str = String.fromCharCode(ch);
			}
			aok = true;
			for(i = 0 ; i < this.keys.length ; i++){ if(this.keys.charCode == ch && this.keys.altKey == alt) aok = false; }
			if(aok) this.keys.push({'str':str,'charCode':ch,'char':String.fromCharCode(ch),'fn':fn,'txt':txt,'altKey':alt});
		}
		return this;
	}

	SpaceTelescope.prototype.toggleMenus = function(id,e){

		if(e && typeof e==="object") e.preventDefault();
		var m = $('.dropdown');
		var a = (e) ? $(e.currentTarget).attr('href') : "";
		
		for(var i = 0; i < m.length ; i++){
			var _obj = this;
			if($(m[i]).attr('id') == id) $(m[i]).toggle(0,function(){ if(a && a.indexOf('#') >= 0) _obj.setScroll('#'+a.split('#')[1]); });
			else $(m[i]).hide();
		}

		// Move to messages
		if(id=="messages") this.setScroll('#'+id);

		return this;
	}

	SpaceTelescope.prototype.scrollMenus = function(id){
		$('.dropdown.fullwidth:visible').each(function(){
			var t = parseInt($(this).css('top'));
			var h = $('#bar').outerHeight();
			var y = window.scrollY;
			if(t <= h) $('.dropdown').css({'top':h});
			if(t > y+h) $('.dropdown').css({'top':y+h});
		});
		return this;
	}

	
	SpaceTelescope.prototype.setVar = function(v,t){
		if(typeof v==="string"){
			if(this.i && typeof this.i[v]===t) this.settings[v] = this.i[v];
			// Was it set in the query string?
			if(typeof this.q[v]===t){
				this.settings[v] = this.q[v];
				// When the setting is provided in the query string we'll also set a cookie with the value
				if(this.settings.usecookies) setCookie('spacetelescope.'+v,this.settings[v],1);
			}
			if(this.settings.usecookies){
				// See if we've set a cookie for this value.
				var cookie = getCookie('spacetelescope.'+v);
				// If we have a cookie set we use that value
				if(cookie) this.settings[v] = cookie;
			}
		}
		return this;
	}

	// Load the specified language
	// If it fails and this was the long variation of the language (e.g. "en-gb" or "zh-yue"), try the short version (e.g. "en" or "zh")
	SpaceTelescope.prototype.loadConfig = function(fn){
		var url = this.dataurl.replace('%MODE%',this.getMode());
		$.ajax({
			url: url,
			beforeSend: function(xhr){
				if (xhr.overrideMimeType) xhr.overrideMimeType("application/json");
			},
			method: 'GET',
			dataType: 'json',
			context: this,
			error: function(){
				this.log('Error loading '+url);
			},
			success: function(data){
				// Store the data
				this.data = data;
				if(typeof fn==="function") fn.call(this);
			}
		});
		return this;
	}

	// Return the URL string for the mode
	SpaceTelescope.prototype.getMode = function(){ return (this.settings.mode=="advanced") ? '_advanced' : ''; }
	
	// Load the specified language
	// If it fails and this was the long variation of the language (e.g. "en-gb" or "zh-yue"), try the short version (e.g. "en" or "zh")
	SpaceTelescope.prototype.loadLanguage = function(l,fn){
		if(!l) l = this.langshort;
		var m = this.settings.mode;
		var url = this.langurl.replace('%LANG%',l).replace('%MODE%',this.getMode());
		$.ajax({
			url: url,
			beforeSend: function(xhr){
				if (xhr.overrideMimeType) xhr.overrideMimeType("application/json");
			},
			method: 'GET',
			cache: false,
			dataType: 'json',
			context: this,
			error: function(){
				this.log('Error loading '+l+' ('+m+')');
				if(this.lang.length == 2){
					this.log('Attempting to load default (en) instead');
					this.loadLanguage('en',fn);
				}else{
					if(url.indexOf(this.lang) > 0){
						this.log('Attempting to load '+this.langshort+' instead');
						this.loadLanguage(this.langshort,fn);
					}
				}
			},
			success: function(data){
				this.langshort = l;
				this.lang = l;
				// Store the data
				this.phrases = data;
				this.loadScenarios(fn);
			}
		});
		return this;
	}

	// Load the scenarios
	SpaceTelescope.prototype.loadScenarios = function(fn){
		var m = this.settings.mode;
		var url = this.scenariourl.replace('%LANG%',this.langshort).replace('%MODE%',this.getMode());
		$.ajax({
			url: url,
			beforeSend: function(xhr){
				if (xhr.overrideMimeType) xhr.overrideMimeType("application/json");
			},
			method: 'GET',
			dataType: 'json',
			context: this,
			error: function(){
				this.log('Error loading '+url+' ('+m+')');
				if(typeof fn==="function") fn.call(this);
			},
			success: function(data){
				this.scenarios = data.scenarios;
				if(typeof fn==="function") fn.call(this);
			}
		});
		return this;
	}

	// Select scenario
	SpaceTelescope.prototype.chooseScenario = function(i){
		this.log('chooseScenario',i);
		this.scenario = this.scenarios[i];
		this.stage = "designer";
		$('#summary').show();
		this.updateSummary().updateLanguage();
		return this;
	}
	
	// Update the page using the JSON response
	SpaceTelescope.prototype.update = function(){

		this.log('update')

		if(!this.phrases || !this.data) return this;

		this.buildPage().updateLanguage().makeSpace().displayOrbits();

		$('#language.dropdown').hide()
		
		// Is this the first time we've called this function since page load?
		if(!this.loaded){
			// Executed on page load with URL containing an anchor tag.
			this.navigate();
			this.loaded = true;
		}
		
		return this;
	}

	SpaceTelescope.prototype.addInstrument = function(){
		if(!this.choices.instruments) this.choices.instruments = [];

		var i = this.getValue('#instruments');
		var w = this.getValue('#wavelengths');
		var n = this.getValue('#instrument_name');

		if(i && w){
			if(!n) n = this.phrases.designer.instruments.defaultname.replace(/%d%/,(this.choices.instruments.length+1));
			this.choices.instruments.push({'name':n,'type':i,'wavelength':w});
			this.updateInstruments();
		}
		return this;
	}

	SpaceTelescope.prototype.removeInstrument = function(i){
		i = parseInt(i,10);
		if(i < this.choices.instruments.length) this.choices.instruments.splice(i,1)
		this.updateInstruments();
		return this;
	}
	
	SpaceTelescope.prototype.displayInstruments = function(){
		var html = "";
		var d = this.phrases.designer;
		this.log('displayInstruments');
		html += '<h3>'+d.instruments.table.title+'</h3><div class="tablewrapper"><table><tr><th>'+d.instruments.table.name+'</th><th>'+d.instruments.table.type+'</th><th>'+d.instruments.table.cost+'</th><th>'+d.instruments.table.mass+'</th><th>'+d.instruments.table.temperature+'</th><th></th></tr>';
		if(this.choices.instruments && this.choices.instruments.length > 0){
			for(var i = 0; i < this.choices.instruments.length; i++){
				v = this.getInstrument({'wavelength':this.choices.instruments[i].wavelength,'type':this.choices.instruments[i].type})
				html += '<tr><td>'+this.choices.instruments[i].name+'</td><td>'+v.wavelength+' '+v.type+'</td><td>'+this.formatValueSpan(v.cost)+'</td><td>'+this.formatValueSpan(v.mass)+'</td><td>'+this.formatValueSpan(v.temp)+'</td><td><a class="remove_instrument" href="#" title="'+this.phrases.designer.instruments.options.remove+'" data="'+i+'"><img class="icon minus" src="images/cleardot.gif"></a></td></tr>';
			}
		}
		html += '</table></div>';
		$('#designer_instruments .instrument_list').html(html);
		return html;
	}
	
	SpaceTelescope.prototype.updateInstruments = function(){

		this.log('updateInstruments');
		this.displayInstruments();
		this.parseChoices('designer_instruments');
		return this;
	}
	
	SpaceTelescope.prototype.makeSatellite = function(){

		this.log('makeSatellite');
		if(!this.satellite) this.satellite = {};
		var s = this.satellite;
		if(!s.el) s.el = $('#sidebar .satellite.panel');
		if(s.el.find('#schematic').length==0) s.el.html('<div id="schematic"></div>')

		var h = 160;
		var w = $('#sidebar').innerWidth();
		var d;
		var prop = { 'mirror': 0, 'bus': 0, 'slots': 0 };

		var c = Math.cos(Math.PI*30/180);
		if(this.choices.mirror){
			for(var m in this.data.mirror){
				d = this.convertValue(this.data.mirror[m].diameter,'m');
				if(m==this.choices.mirror) prop.mirror = d.value;
			}
			for(var m in this.data.mirror){
				d = this.convertValue(this.data.mirror[m].bus.diameter,'m');
				if(m==this.choices.mirror){
					prop.bus = d.value;
					if(this.choices.deployablemirror && this.data.deployablemirror.multiplier.bus.diameter) prop.bus *= this.data.deployablemirror.multiplier.bus.diameter;
					prop.slots = this.data.mirror[m].bus.instrumentslots;
				}
			}
		}

		var padd = 16;	// padding in pixels

		var f = Math.floor(w/32);	// scale factor
		var fb = f*(prop.bus/prop.mirror);	// scale factor for bus width
		var bodyh = 8;	// height of satellite body in units of f
		var insth = 2;   // The height of the instruments
		var hbus = 10*fb;
		// Work out size of cryogenic tank based on the cryo-life
		var tank = (this.choices.cooling.cryogenic ? this.choices.cooling.cyrogeniclife : 0);
		// If we've not set the tank size and we're in basic mode we'll draw a tank if the set temperatue is low enough
		if(tank==0 && this.choices.cool.temperature){
			var t = this.convertValue(this.choices.temperature,'K');
			// Scale the tank based on the temperature acheived
			if(t.value < 50) tank = Math.log(50/t.value);
		}
		var bodytop = 4; // The height of the neck at the top of the dewar
		var hbody = ((bodyh+bodytop+tank)*f);	// The height of the dewar
		var hmirror = 13*f;	// The height of the mirror
		var hvgroove = (this.choices.cooling.passive ? 2*f : 0); // The height of the vgrooves
		if(this.choices.cool.temperature){
			var t = this.convertValue(this.choices.temperature,'K');
			if(t.value < 300) hvgroove = 2*f;
		}
		h = (this.choices.mirror) ? hbus+hbody+hmirror+hvgroove+(2*padd) : 0;

		this.resizeSatellite("auto",h);

		if(this.satellite.bus){
			this.satellite.bus.remove();
			delete this.satellite.bus;
		}
		if(this.satellite.body){
			this.satellite.body.remove();
			delete this.satellite.body;
		}
		if(this.satellite.vgroove){
			this.satellite.vgroove.remove();
			delete this.satellite.vgroove;
		}
		if(this.satellite.mirror){
			this.satellite.mirror.remove();
			delete this.satellite.mirror;
		}

		// Define some styles
		var solid = {'stroke':'white','stroke-width':1,'fill':'white','fill-opacity':0.5};		
		var solidlight = {'stroke':'white','stroke-width':1,'fill':'white','fill-opacity':0.15};		
		var stroke = {'stroke':'white','stroke-width':1};

		if(this.choices.mirror){
			s.bus = s.paper.set();
			// Solar shield
			s.bus.push(s.paper.ellipse(0,3.5*fb,10*fb,6*fb).attr(solid));
			// Top of bus
			s.bus.push(s.paper.path('m '+(-8.5*fb)+', '+(-2*fb)+' l0,'+(4*fb)+' l'+(5*fb)+','+(3*fb)+' l'+(7*fb)+',0 l'+(5*fb)+','+(-3*fb)+' l0,'+(-4*fb)+' l'+(-5*fb)+','+(-3*fb)+' l'+(-7*fb)+',0 z').attr(solid));
			// Bus sides
			s.bus.push(s.paper.path('m '+(-8.5*fb)+', '+(2*fb)+' l0,'+(3.5*fb)+' l'+(5*fb)+','+(3*fb)+' l0,'+(-3.5*fb)+' z').attr(solid));
			s.bus.push(s.paper.path('m '+(-3.5*fb)+', '+(5*fb)+' l'+(7*fb)+',0 l0,'+(3.5*fb)+' l'+(-7*fb)+',0 z').attr(solid));
			s.bus.push(s.paper.path('m '+(8.5*fb)+', '+(2*fb)+' l0,'+(3.5*fb)+' l'+(-5*fb)+','+(3*fb)+' l0,'+(-3.5*fb)+' z').attr(solid));
		}

		if(hvgroove > 0){
			s.vgroove = s.paper.set();
			s.vgroove.push(s.paper.ellipse(0,-0.6*fb,8.5*fb,5*fb).attr(solidlight));
			s.vgroove.push(s.paper.ellipse(0,-1.2*fb,8.25*fb,4.75*fb).attr(solidlight));
			s.vgroove.push(s.paper.ellipse(0,-1.8*fb,8*fb,4.5*fb).attr(solidlight));
			s.vgroove.push(s.paper.path('m 0,'+(-0.6*fb)+' l'+(-5.5*fb)+','+(2.5*fb)+' m'+(5.5*fb)+','+(-2.5*fb)+' l'+(1.5*fb)+','+(3.5*fb)+' m'+(-1.5*fb)+','+(-3.5*fb)+' l'+(8*fb)+','+(-fb)+' m'+(-8*fb)+','+(fb)+' l'+(5*fb)+','+(-5*fb)+' m'+(-5*fb)+','+(5*fb)+' l'+(-2*fb)+','+(-5.5*fb)+' m'+(2*fb)+','+(5.5*fb)+' l'+(-7*fb)+','+(-3*fb)).attr({'stroke':'white','stroke-width':1,'stroke-opacity':0.4}))
		}
		
		if(this.choices.mirror){
			s.body = s.paper.set();
			var bw = Math.min(7,8.5*(prop.bus/prop.mirror));
			var bt = bw*0.4;
			var bh = (bw-bt);
			// Base circle for body
			s.body.push(s.paper.ellipse(0,0,bw*f,bh*f).attr(stroke));
			// Shape of body
			s.body.push(s.paper.path('m '+(-bw*f)+',0 a '+(bw*f)+','+(bh*f)+' 0 0,0 '+(2*bw*f)+',0 l 0,'+(-(bodyh+tank-1)*f)+' q 0,'+(-2*f)+' '+(-bh*f)+','+(-bodytop*f)+' l0,'+(-1*f)+' a'+(bt*f)+','+(bt*0.5*f)+' 0 0,0 '+(-2*bt*f)+',0 l0,'+(1*f)+' q'+(-bh*f)+','+(1*f)+' '+(-bh*f)+','+(bh*f)+' z').attr(solid));
			if(tank > 0){
				// Tank 
				s.body.push(s.paper.path('m '+(-bw*f)+',0 a '+(bw*f)+','+(bh*f)+' 0 0,0 '+(2*bw*f)+',0 l 0,'+(-tank*f)+' a '+(bw*f)+','+(bh*f)+' 0 0,0 '+(-2*bw*f)+',0 z').attr({'stroke':'white','stroke-width':1,'fill':$('.mass').css('color'),'fill-opacity':0.3}));
				s.body.push(s.paper.ellipse(0,(-tank*f),bw*f,bh*f).attr(stroke));
			}
			// Top circle
			s.body.push(s.paper.ellipse(0,(-(bodyh+tank+bodytop)*f),bt*f,bt*0.5*f).attr(stroke));

			// Build instrument slots
			var cols = Math.ceil(prop.slots/2);	// How many columns of instruments do we have?
			var x,y,xl,yl;
			var instw = 2.2; // The width of the instrument
			instw = bw*2/(cols+2)
			var i2 = instw/2; // Half the width
			var i4 = instw/4; // Quarter the width
			// Styles for slots
			var open = {'stroke':'white','stroke-width':1,'stroke-dasharray':'- ','fill':'white','fill-opacity':0.2};
			var filled = {'stroke':'white','stroke-width':1,'fill':$('.science').css('color'),'fill-opacity':1}; // Use the 'science' colour
			var n = 0;
			var ni = 0;

			if(this.choices.instruments) ni = this.choices.instruments.length;
			$('#schematic .label').remove();
			var html = "";

			// Loop over instruments
			for(var i = 0 ; i < cols; i++){
				x = (i-(cols-1)/2)*(instw*f*1.25);
				for(var j = 0; j < 2; j++){
					y = tank + 1.5 + (j==0 ? 0 : insth*2);
					xl = 0.5 + (x+(j==0 ? i4*f : 0))/w;
					yl = (padd+(hbus+hvgroove+(y+(j==0 ? -insth : +insth*1.5))*f))/h;
					s.body.push(s.paper.path('m'+(x-i2*f)+','+(-y*f)+' l'+(i2*f)+','+(i4*f)+' l'+(i2*f)+','+(-i4*f)+' l0,'+(-insth*f)+' l'+(-i2*f)+','+(-i4*f)+' l'+(-i2*f)+','+(i4*f)+' z m'+(i2*f)+','+(i4*f)+' l0,'+(-insth*f)+' l'+(-i2*f)+','+(-i4*f)+'m'+(i2*f)+','+(i4*f)+'l'+(i2*f)+','+(-i4*f)).attr((n < ni) ? filled : open));
					// Add a label if we can apply a CSS3 transform
					if(n < ni && this.choices.instruments[n] && this.hastransform) html += '<div class="label '+(j==0 ? 'bottom':'top')+'" style="bottom:'+(100*yl)+'%; left:'+(100*xl)+'%">'+this.choices.instruments[n].name+'</div>';
					n++;
				}
			}
			if(html) $('#schematic').prepend(html);
		}

		if(this.choices.mirror){
			s.mirror = s.paper.set();
			// Primary mirror
			s.mirror.push(s.paper.ellipse(0,-2.5*f,10*f,6*f).attr(solid));
			// Hole in primary mirror
			s.mirror.push(s.paper.ellipse(0,0,1*f,0.6*f).attr(solid));
			// Draw back struts
			s.mirror.push(s.paper.path('m '+(-2*f)+','+(-11*f)+' l'+(-3*f)+','+(6*f)+' l '+(5*f)+','+(-7*f)+' l'+(5*f)+','+(7*f)+' l'+(-3*f)+','+(-6*f)).attr(stroke));
			// Draw front struts
			s.mirror.push(s.paper.path('m '+(-2*f)+','+(-11*f)+' l'+(2*f)+','+(-1*f)+' l 0,'+(-1*f)+' l'+(-2*f)+','+(1*f)+' z').attr(solid));
			// Draw back secondary mirror structure
			s.mirror.push(s.paper.path('m '+(2*f)+','+(-11*f)+' l'+(-2*f)+','+(-1*f)+' l 0,'+(-1*f)+' l'+(2*f)+','+(1*f)+' z').attr(solid));
			s.mirror.push(s.paper.path('m '+(-2*f)+','+(-11*f)+' l'+(-4*f)+','+(12*f)+' l '+(6*f)+','+(-11*f)+' l'+(6*f)+','+(11*f)+' l'+(-4*f)+','+(-12*f)).attr(stroke));
			// Draw secondary mirror
			s.mirror.push(s.paper.ellipse(0,(-11*f),2*f,1*f).attr(solid));
			// Draw front of secondary mirror structure
			s.mirror.push(s.paper.path('m '+(-2*f)+','+(-12*f)+' l'+(2*f)+','+(1*f)+' l 0,'+(1*f)+' l'+(-2*f)+','+(-1*f)+' z').attr(solid));
			s.mirror.push(s.paper.path('m '+(2*f)+','+(-12*f)+' l'+(-2*f)+','+(1*f)+' l 0,'+(1*f)+' l'+(2*f)+','+(-1*f)+' z').attr(solid));
		}

		// Move bus
		if(s.bus) for(var i = 0; i < s.bus.length; i++) transformer(s.bus[i],['t',w/2,h - padd - hbus]);
		// Move vgroove
		if(s.vgroove) for(var i = 0; i < s.vgroove.length; i++) transformer(s.vgroove[i],['t',w/2,h - padd -hbus]);
		// Move body
		if(s.body) for(var i = 0; i < s.body.length; i++) transformer(s.body[i],['t',w/2,h - padd - hbus - hvgroove]);
		// Move mirror
		if(s.mirror) for(var i = 0; i < s.mirror.length; i++) transformer(s.mirror[i],['t',w/2,h - padd -hbus - hvgroove - hbody]);


		this.satellite = s;
		return this;
	}
	
	SpaceTelescope.prototype.resizeSatellite = function(w,h){

		this.log('resizeSatellite');
		var s = $('#sidebar');
		
		// Hide the contents so we can calculate the size of the container
		this.satellite.el.children().hide();

		// Make the element fill the container's width
		this.satellite.el.css({'width':'auto','display':'block'});

		// Get the inner width of the space container (i.e. without margins)
		if(!w || w=="auto") w = this.satellite.el.innerWidth();
		if(w < s.width()/2) w = s.width()-(parseInt(this.satellite.el.css('margin-left'),10) + parseInt(this.satellite.el.css('margin-right'),10));
		if(!h) h = w/2;

		// Check if the HTML element has changed size due to responsive CSS
		if(w != this.satellite.width || h != this.satellite.height || this.satellite.width==0){
			this.satellite.width = w;
			if(this.satellite.width == 0) this.satellite.width = s.width()-(parseInt(this.satellite.el.css('margin-left'),10) + parseInt(this.satellite.el.css('margin-right'),10));
			this.satellite.height = h;

			// Create the Raphael object to hold the vector graphics
			if(!this.satellite.paper){
				this.satellite.paper = Raphael('schematic', this.satellite.width, this.satellite.height);
			}else{
				this.satellite.paper.setSize(this.satellite.width,this.satellite.height);
				this.satellite.rebuild = true;
			}
		}

		// Show the contents again
		this.satellite.el.children().show();

		return this;	
	}
	
	// Create an animation area for the orbit animations
	SpaceTelescope.prototype.makeSpace = function(zoom){

		this.log('makeSpace',zoom)

		if(!this.space) this.space = { width: 0, height: 300, zoom: 0, scale: [1,0.022], anim: {}, orbits:{}, labels:{} };
		if(typeof zoom==="number") this.space.zoom = zoom;
		this.space.el = $('#orbits');
		if(!this.space.el.is(':visible')) return this;
		if(!this.space.paper) this.resizeSpace();

		return this;
	}

	// Resize the orbit animation area
	SpaceTelescope.prototype.resizeSpace = function(){

		this.log('resizeSpace')
		if(!this.space) this.makeSpace();

		// Hide the contents so we can calculate the size of the container
		if(this.space && this.space.el.length > 0) this.space.el.children().hide();

		// Make the element fill the container's width
		this.space.el.css({'width':'auto','display':'block'});
		
		// Get the inner width of the space container (i.e. without margins)
		var w = this.space.el.innerWidth();
		if(w < $('#designer_orbit').width()/2) w = $('#designer_orbit').width()-(parseInt(this.space.el.css('margin-left'),10) + parseInt(this.space.el.css('margin-right'),10));
		var h = w/2;

		// Check if the HTML element has changed size due to responsive CSS
		if(w != this.space.width || h != this.space.height || this.space.width==0){
			this.space.width = w;
			if(this.space.width == 0) this.space.width = $('#designer_orbit').width()-(parseInt(this.space.el.css('margin-left'),10) + parseInt(this.space.el.css('margin-right'),10));
			this.space.height = h;

			// Create the Raphael object to hold the vector graphics
			if(!this.space.paper){
				this.space.paper = Raphael('orbits', this.space.width, this.space.height);
			}else{
				this.space.paper.setSize(this.space.width,this.space.height);
				this.space.rebuild = true;
			}
			// Define Earth and Moon
			this.space.E = { x: this.space.width/2, y: this.space.height/2, r: this.space.height/6, radius: 6378 };
			this.space.M = { r: 5, o: this.space.E.r*58 };
		}

		// Calculate the orbits to show
		this.displayOrbits();

		// Show the contents again
		this.space.el.children().show();

		return this;	
	}
	
	SpaceTelescope.prototype.selectOrbit = function(key){

		if(key){
			$('#designer_orbit #mission_orbit').val(key);
			$('#designer_orbit #mission_orbit').trigger('change');
		}

		return this;
	}

	// Highlight the selected orbit (uses the value from the select dropdown)
	// If necessary (i.e. if the zoom level has changed) redisplay the orbits first.
	SpaceTelescope.prototype.highlightOrbit = function(key){

		this.log('highlightOrbit',key,this.space)

		if(!key) return this;

		this.displayOrbits(key);

		// Update SVG elements
		for(var o in this.space.orbits){
			if(o==key) this.space.orbits[o].selected = true;
			else this.space.orbits[o].selected = false;
			this.space.orbits[o].dotted.attr({'stroke-width':(this.space.orbits[o].selected ? this.space.orbits[o].inp.stroke.selected : this.space.orbits[o].inp.stroke.off)});
			this.space.orbits[o].satellite.attr({'r':(this.space.orbits[o].selected ? 8 : 4),'stroke-width':(this.space.orbits[o].selected ? 8 : 0),'stroke':'white','stroke-opacity':0.5});
		}

		return this;
	}

	SpaceTelescope.prototype.removeOrbits = function(){
		for(var o in this.space.orbits){
			if(this.space.orbits[o].dotted) this.space.orbits[o].dotted.stop().remove();
			if(this.space.orbits[o].solid) this.space.orbits[o].solid.stop().remove();
			if(this.space.orbits[o].satellite) this.space.orbits[o].satellite.stop().remove();
			delete this.space.orbits[o];
		}
		var a = ['Moon','Moonorbit','Moonlagrangian','Earthorbit'];
		for(var i = 0 ; i < a.length; i++){
			if(this.space[a[i]]){
				this.space[a[i]].remove();
				delete this.space[a[i]];
			}
		}
		for(var l in this.space.labels){
			for(var i in this.space.labels[l]){
				if(typeof this.space.labels[l][i].remove==="function"){
					this.space.labels[l][i].remove();
					delete this.space.labels[l][i];
				}
			}
			delete this.space.labels[l];
		}
		return this;
	}

	SpaceTelescope.prototype.displayOrbits = function(key,zoom){

		this.log('displayOrbits',key,zoom)

		if(!this.space.paper) return this;

		// Properties for the orbit animation
		this.orbits = {
			"GEO": { "inclination": 0, "color": "#048b9f", "ellipticity": 0.3, "zoom": 0, "z": false },
			"SNS": { "inclination": -90, "color": "#7ac36a", "ellipticity": 0.4, "zoom": 0, "z": true },
			"HEO": { "inclination": 30, "color": "#de1f2a", "ellipticity": 0.4, "r": this.space.E.r*3.3, "zoom": 0, "z": false },
			"LEO": { "inclination": -30, "color": "#cccccc", "ellipticity": 0.4, "zoom": 0, "z": true },
			"EM2": { "inclination": 0, "color": "#cccccc", "ellipticity": 1, "zoom": 1, "z": false },
			"ES2": { "inclination": 0, "color": "#9467bd", "ellipticity": 1, "zoom": 1, "z": false },
			"ETR": { "inclination": 0, "color": "#fac900", "ellipticity": 1, "zoom": 1, "z": false }
		}
		
		if(key) this.space.zoom = this.orbits[key].zoom;
		if(typeof zoom==="number") this.space.zoom = zoom;

		// r - radius
		// e - ellipticity
		// a - inclination angle
		function makeOrbitPath(r,e,a){
			if(!a || typeof a !== "number") a = 0;
			var dy = r*Math.sin(a*Math.PI/180);
			var dx = r*Math.cos(a*Math.PI/180);
			// Big cludge as I can't work out how the ellipses are positioned when rotation is applied
			if(Math.abs(a) > 80){
				dy += r;
				dx += r*e;
			}
			return " m "+(0-dx)+" "+(0-dy)+" a " + (r) + "," + (e*r) + " "+a+" 1,1 0,0.01";
		}

		function hide(el){ if(el) el.hide(); }
		function show(el){ if(el) el.show(); }

		if(this.space.rebuild){
			this.removeOrbits();
			this.space.rebuild = false;
		}

		if($('#orbits .zoomer').length==0){
			$('#orbits').prepend('<a href="#" class="zoomer button">-</a>');
			$('#orbits .zoomer').on('click',{me:this},function(e){
				e.preventDefault();
				e.data.me.displayOrbits('',(e.data.me.space.zoom==0 ? 1 : 0));
				$(this).html(e.data.me.space.zoom==0 ? '&minus;' : '&plus;').attr('title',(e.data.me.space.zoom==0 ? e.data.me.phrases.designer.orbit.zoomout : e.data.me.phrases.designer.orbit.zoomin));
			});
		}

		
		if(this.space.Earth) this.space.Earth.remove();
		if(this.space.zoom == 0) this.space.Earth = this.space.paper.path('M '+(this.space.E.x)+' '+(this.space.E.y)+' m -6.927379,42.861897 c -10.79338,-1.89118 -21.17473,-8.25868 -27.52258,-16.87977 -15.02038,-20.3975403 -9.63593,-48.89125 11.79388,-62.41291 16.94554,-10.68989 39.20392,-8.16663 53.44137,6.06404 5.87268,5.86844 9.54913,12.35889 11.55616,20.4047297 1.16835,4.68267 1.47335,12.35457 0.67442,16.96248 -3.048,17.5816003 -15.4426,30.9321203 -32.72769,35.2509203 -4.33566,1.08222 -12.80575,1.3828 -17.21554,0.61124 z m 11.33951,-4.82289 c 6.979,-0.79891 13.53188,-3.42643 19.13933,-7.67694 1.15933,-0.87801 1.54372,-1.39287 1.55148,-2.07816 0.0111,-1.02039 1.44195,-5.01704 2.21985,-6.20209 0.27849,-0.42427 1.14761,-1.04771 1.93147,-1.3828 1.16726,-0.50337 1.55149,-0.90389 2.12308,-2.23204 0.96595,-2.24427 1.24242,-3.45664 0.78812,-3.45664 -0.20378,0 -0.37027,-0.35953 -0.37027,-0.78883 0,-0.79173 1.79473,-2.69441 4.39774,-4.66182 0.67305,-0.50337 1.30726,-1.14263 1.40925,-1.40725 0.839,-2.1845903 0.99945,-12.8320603 0.19322,-12.8320603 -0.51768,0 -0.70521,2.11843004 -0.37077,4.19083 0.41376,2.56281 0.0979,4.2843 -0.80975,4.4166 -1.268,0.18698 -2.13725,-1.28571 -2.84295,-4.81066 -1.04641,-5.22558 -1.1243,-5.32626 -4.56601,-5.9267 -1.02684,-0.17978 -1.08581,-0.13664 -1.08581,0.81689 0,2.22772 -2.80355,5.66709 -5.01389,6.15248 -1.66562,0.36674 -2.62557,-0.58246 -4.17367,-4.1182 -0.735,-1.67907 -1.59947,-3.31138 -1.92103,-3.62778 -0.55377,-0.5465 -0.58461,-0.53932 -0.58461,0.12942 0,1.72221 2.25458,7.61438 3.13524,8.1954 0.20501,0.13663 1.09432,0.2445 1.97628,0.25168 2.19326,0.006 3.57706,0.7572 3.56758,1.9329 -0.013,1.61147 -1.23802,3.68026 -3.44872,5.8238503 -2.98531,2.89432 -3.55713,3.9449 -3.55867,6.5372 -0.001,2.03428 0.0252,2.10116 0.75047,1.87393 0.41348,-0.12941 1.04826,-0.43864 1.4107,-0.68312 0.98159,-0.67594 2.09973,-0.56808 2.35382,0.2373 0.2447,0.77084 -1.60253,3.96287 -3.39818,5.87203 -0.87967,0.93553 -1.18294,1.07144 -1.83751,0.82552 -0.6725,-0.25169 -0.7809,-0.51776 -0.76252,-1.84374 0.013,-0.95351 -0.11516,-1.50505 -0.33409,-1.43314 -0.34616,0.10794 -0.65537,0.55369 -2.65289,3.74859 -1.17673,1.884 -3.79425,3.67597 -6.07803,4.16206 -1.86971,0.3955 -3.48492,0 -3.48492,-0.7953 0,-0.26607 -0.43326,-1.29723 -0.96281,-2.30323 -1.69574,-3.22007 -1.84288,-3.99595 -1.37585,-7.24909 0.47848,-3.33582 0.19975,-4.72582 -1.21076997,-6.04247 -1.23809,-1.15484 -1.87063003,-2.53763 -1.64033003,-3.58606 0.18366003,-0.8355803 0.0857,-0.9340903 -1.34377,-1.3540303 -1.63056,-0.4818 -5.15549,-0.33078 -7.61198,0.33796 -1.09992,0.30202 -1.50461,0.23729 -2.83756,-0.42426 -2.86801,-1.42451 -4.32003,-4.81858 -3.89918,-9.11581996 0.39299,-4.01250004 0.54491,-4.51441004 1.80953,-5.97273004 0.68343,-0.78955 1.4365,-1.90268 1.67352,-2.47365 0.39117,-0.94344 1.89274,-1.9479897 3.70135,-2.4779597 0.29382,-0.0863 0.93542,-0.95925 0.19912,-1.19654 -2.63115,0.61121 -3.4916,-1.84374 -1.69974,-3.63426 0.98587,-0.98515 1.35751,-1.14982 2.33866,-1.03549 1.08194,0.12941 1.16649,0.0791 1.16649,-0.77733 0,-0.49616 0.15034,-1.00814 0.33409,-1.12032 0.18367,-0.11497 1.44636,-0.95208 1.44636,-1.06713 0,-0.36673 -4.64238,1.86027 -2.8525,-0.67594 -0.26146,0.41707 -0.65956,0.19416 -1.1224,-0.26605 -0.87213,-0.87083 0.29445,-1.80204 1.00761,-1.97534 0.45202,-0.006 0.96756,1.28718 1.31068,0.58247 -0.82013,-1.1455 -0.62158,-2.63904 -0.28282,-2.70519 1.2859,-0.53932 1.49537,0.78523 1.49537,1.81137 0,0.39548 0.2255,0.91683 0.50112,1.14478 0.27563,0.2373 0.50113,0.79099 0.50113,1.25048 0,0.76151 0.0941,0.81689 1.06974,0.62562 1.49278,-0.30203 2.53575,-1.36699 2.47682,-2.53838 2.67534003,-1.78908 -0.15886,-1.06713 -0.29398,-1.20302 -0.63709,-0.63281 -0.13885,-1.83798 1.40482003,-3.38761 2.14169997,-2.15005 3.38975997,-2.7095 6.99786997,-3.13593 2.72694,-0.32359 3.09543,-0.29482 4.55125,0.35235 1.4815,0.64719 1.57109,0.76511 1.3838,1.70136 l -0.20026,0.99953 1.80809,-0.9643 c 0.99444,-0.53212 2.56916,-1.15844 3.49938,-1.39646 0.93019,-0.2373 1.69128,-0.56808 1.69128,-0.72556 0,-0.3811 -4.20122,-2.31041 -6.97024,-3.21358 -5.23627,-1.70998 -13.51182,-2.25217 -18.83832,-1.23323 -4.60384,0.87944 -12.69228,4.14912 -13.13855,5.31187 -0.0896,0.2373 0.0676,0.97293 0.34883,1.64671 0.63899,1.52734 0.65767,3.66589 0.0424,4.84878 -0.61531,1.18145 -5.09802,5.49956 -6.37985,6.14601 -0.55124,0.27325 -2.28017,0.92043 -3.84205,1.42882 -4.30776,1.40509 -4.48483,1.5338 -5.46145,3.96935 -1.64357,4.1023697 -2.26852,7.1311597 -2.45187,11.88357974 l -0.17385,4.50720996 2.56104,2.13282 c 1.40855,1.17211 3.47725,3.15461 4.59709,4.4043803 1.51998,1.6956 2.48972,2.45639 3.82568,2.99714 1.96471,0.79675 3.45111,2.28165 3.45111,3.4473 0,0.40987 -0.24263,1.46045 -0.53917,2.3291 -0.49906,1.46407 -0.49746,1.69129 0.0209,3.04604 0.6264,1.6388 0.35646,2.62899 -0.81789,3.00146 -0.81891,0.26607 -0.85988,1.23396 -0.10053,2.39168 0.31237,0.4746 0.65063,1.48204 0.7517,2.23635 0.17385,1.29723 0.34977,1.48131 3.26152,3.42284 7.40928,4.93795 16.4231,7.13547 25.16577,6.13379 z m 8.48287,-49.9181103 c 0.68449,-0.6759197 0.66479,-1.1239097 -0.0596,-1.3360497 -0.3215,-0.10072 -2.2514,-1.55826 -2.92906,-1.89694 -1.01081,-0.49617 6.7196,-1.01966 1.45075,-3.16972 -5.26885,-2.15079 -2.56176,4.83655 -3.32655,3.88017 -0.65552,-0.8327 -2.0022,-1.01104 -2.5835,-0.48178 -1.15634,-1.28069 -2.98745,-3.84351 -3.70189,-3.89241 -1.03907997,-0.0718 1.16978,2.32983 -0.27577,2.81665 -1.44553997,0.48898 -2.20706997,-2.826 -4.09265,-2.61817 -2.10817,0.2373 -4.38327,-0.72484 -5.18683,3.39191 -0.004,0.52493 3.06135,0.16533 4.50771,0 2.32603003,-0.3092 3.10989003,0 5.24841,1.91132 l 1.88004,1.7013597 3.25884,-0.2373 c 2.19723,-0.1583 3.33099,-0.11497 3.48033,0.1222 0.3297,0.53212 1.72994,0.42425 2.32983,-0.16534 z M 4.909541,-24.277303 c 0.94202,-0.43865 1.16153,-0.7191 1.01819,-1.2505 -0.10053,-0.38112 -0.18477,-0.86794 -0.18732,-1.09733 0.15107,-1.64957 -0.72375,-1.29793 -1.57539,-0.0718 -0.77094,1.13326 -4.82187997,5.26872 -0.61209,2.96477 0.0752,-0.0718 0.69614,-0.25886 1.35664,-0.56807 z m 20.69451,-1.74667 c 0.2363,-0.38111 -1.04497,-1.12824 -1.47795,-0.86075 -0.16792,0.10072 -0.95404,-0.15107 -1.74709,-0.56808 -1.95859,-1.02828 -6.42112,-0.95134 -5.77085,0.10072 0.10572,0.17256 1.42366,0.3164 2.92877,0.3164 2.03716,8.3e-4 3.03539,0.16533 3.90586,0.6328 1.36846,0.73274 1.8913,0.82694 2.16126,0.3883 z');
		else this.space.Earth = this.space.paper.path('M '+(this.space.E.x)+' '+(this.space.E.y)+' m 0 -43.6 c,-19.195,-0.359,-37.44,13.34,-41.865,32.015 c,-4.561096,17.1667748,2.72917,37.246587,17.656538,46.977656 c,13.373687,9.285707,32.0526208,9.996435,45.992018,1.508414 c,5.957424,-3.319826,11.075156,-8.039317,14.543607,-13.935126 c,10.546018,-15.6499112,8.720274,-38.18332,-4.018314,-52.068038 c,-8.07768,-9.096389,-20.115729,-14.609639,-32.30837958,-14.498209 z m,0.09375,5.375 c,12.57022058,-0.128555,24.94591858,6.5994,31.74999958,17.15625 c,-0.94917,5.002919,-6.086293,1.530374,-3.041063,-1.619594 c,-1.457671,-0.526126,-4.932858,2.878261,-6.847657,-0.603915 c,-3.184453,-1.308637,-6.3599,1.691261,-5.15979,4.188482 c,-3.782846,2.664376,-6.163477,-4.184848,-10.1526402,-1.250482 c,0.930713,-0.712397,6.3522672,-6.132291,1.9485113,-5.743768 c,-2.1471153,3.268504,-5.9001547,5.6116,-9.7549386,6.742359 c,-3.0333281,1.666497,3.4871809,3.919715,5.0848899,3.874212 c,4.4525294,2.286084,8.5800896,7.1007845,6.1927696,12.1877615 c,1.90772,3.21337796,3.996962,6.758283,2.957496,10.7455353 c,-1.088944,1.5975017,-1.993627,6.6457482,-3.8098779,5.9629142 c,0.09411,-5.5523502,-5.8551147,1.424572,-5.9032977,3.921686 c,-0.233555,1.607328,-2.089538,4.666463,0.316221,3.452139 c,1.5791784,3.031545,4.0433554,1.23024,2.5706854,-1.432668 c,-0.755832,-2.214988,1.071785,-4.450478,1.431817,-0.910521 c,3.4227102,1.986574,-2.079278,8.026424,-3.441317,4.221977 c,-0.05038,3.190668,-5.9116094,4.835384,-6.2547064,5.746188 c,2.90918203,2.904457,-1.551746,2.079951,-3.228894,2.254064 c,-1.300676,5.220523,5.49423002,3.315504,6.569102,-0.06951 c,2.572843,-3.120142,7.9417807,2.476723,8.2176023,0.158591 c,-5.1570029,-2.906592,4.3679773,1.498193,3.7328613,-0.172704 c,0.355589,-3.393695,5.711734,0.663429,6.832822,-2.635732 c,2.782198,1.056601,-3.254675,4.26505,-4.941003,4.473991 c,-2.714088,0.573027,-2.35272,4.236763,-5.7564619,2.583428 c,-3.9108453,-2.119881,-7.9960437,-0.807618,-12.0653907,-0.15703 c,-4.931145,2.236895,-10.2173174,1.74978,-14.8366384,-1.385684 c,-10.813803,-5.566552,-18.524599,-16.654538,-20.004852,-28.7192222 c,2.732778,2.989211,6.598056,4.7293091,8.998081,8.3559682 c,1.599527,0.730324,3.945675,3.523961,4.82994,3.171984 c,1.833841,-2.480098,4.151057,-5.772095,2.790203,-8.5464922 c,3.363681,-2.474446,-0.289772,-5.5676083,-3.153322,-3.525176 c,-4.391341,0.818177,-0.191169,-4.9463963,1.391046,-6.2324653 c,2.857681,-0.460706,3.513174,2.41500097,3.980956,3.732494 c,3.316523,-0.0353,0.834669,-3.882306,4.374542,-4.092336 c,0.130908,-1.411563,-3.481833,-2.709873,-0.211945,-1.771103 c,4.26026,-1.249006,1.634257,-4.365219,-0.493731,-3.1780419 c,2.763194,-2.1547021,4.181646,-7.6700956,8.5041634,-6.4331296 c,2.24906,-0.416067,2.612667,-2.860803,1.014942,-3.538046 c,2.719085,-1.835258,-1.409228,-1.787455,-0.10076,-4.29649 c,-1.830306,-0.309672,-4.304873,-0.973664,-2.132519,-3.101562 c,-3.3845944,2.57314,-3.5487544,7.860395,-8.9615664,7.398945 c,-4.539774,1.777416,-8.333796,-1.761858,-12.015717,-2.70409 c,-1.477835,0.696073,-6.487149,4.76626,-4.024621,0.665479 c,6.584664,-11.488859,19.533888,-19.038283,32.80405842,-18.874686 z m,-33.65625042,21.59375 c,-0.631472,0.607654,-1.285523,0.774007,0,0 z m,25.0312504,13.8749985 c,-1.378264,1.634778,-4.7210584,3.734578,-0.438841,3.849626 c,2.052676,0.491366,5.022044,2.343429,3.253406,-0.95631404 c,-0.419504,-1.86979296,-2.20923,-1.09186896,-2.814565,-2.89331196 z m,-4.0625014,1.78125 c,-4.153103,-0.46570203,-2.208863,6.0465023,-6.129842,6.4757613 c,-0.605185,2.103009,2.300217,1.325155,3.030352,1.204245 c,1.416321,-2.463228,3.738442,-4.4874303,3.09949,-7.6800063 z m,3.5312514,3.03125 c,0.05302,4.2453083,-2.3776964,7.126859,-5.9261904,8.5371375 c,-2.819523,3.208873,0.326358,5.688926,2.91859,2.404436 c,3.6624634,0.820099,7.4597394,0.468648,8.5987314,-3.8347225 c,3.98761402,-4.1394317,-1.837631,-7.108603,-5.591131,-7.106851 z m,2.65625,13.8750015 c,-4.0821284,2.583778,5.79884807,0.948002,0,0 z m,29.9999996,1 c,-0.310613,2.698258,7.000211,1.533177,2.616976,4.524626 c,-1.843124,0.0678,-6.305665,-2.59259,-2.616976,-4.524626 z m,-25.0937496,4.625 c,-2.608331,0.710104,1.04075402,4.160157,-0.444775,4.552104 c,-1.433649,1.942609,4.729631,-0.163724,1.34758302,-1.892931 c,-0.672,-1.046,-1.062,-1.697,-0.903,-2.659 z m,32.4999996,0.34375 c,-0.01479,2.705677,-5.791353,2.714607,-1.548038,0.956689 l,0.803335,-0.425532 z m,-12.78125,0.375 c,0.523617,1.617196,4.358842,0.626771,1.387,2.500788 c,-1.249506,2.929193,-6.666484,3.760447,-3.932662,-0.407517 c,1.533416,0.532153,2.258563,-0.753125,2.545662,-2.093271 z m,-21.9374996,1.15625 c,-3.15159,1.823608,0.365256,3.975785,0.815462,0.936364 c,-0.0466,-0.434703,-0.359015,-0.867276,-0.815462,-0.936364 z m,26.4374996,6.90625 c,-1.920358,1.510414,-1.942756,0.166742,0,0 z');
		this.space.Earth.attr({ stroke: 0, fill: '#69DFFF', opacity:0.8 });

		var dx,dy,r,e,i,period;

		var _obj = this;
		
		function makeOrbit(inp){
			if(!inp) return null;
			if(!inp.cx) inp.cx = 0;
			if(!inp.cy) inp.cy = 0;
			if(!inp.e) inp.e = 1;
			if(!inp.i) inp.i = 0;
			if(!inp.r) inp.r = 1;
			if(!inp.z) inp.z = false;
			if(!inp.color) inp.color = '#999999';
			if(!inp.stroke) inp.stroke = {};
			if(!inp.stroke.on) inp.stroke.on = 2.5;
			if(!inp.stroke.off) inp.stroke.off = 1.5;
			if(!inp.stroke.selected) inp.stroke.selected = 2.5;
			var p = { inp: inp };
			if(inp.key=="ES2"){
				p.dotted = _obj.space.paper.path("M "+(inp.cx-inp.r)+",0 q "+(inp.r*2)+","+(_obj.space.height/2)+" 0,"+(_obj.space.height));
				p.solid = _obj.space.paper.path("M "+(inp.cx-inp.r)+",0 q "+(inp.r*2)+","+(_obj.space.height/2)+" 0,"+(_obj.space.height));
			}else{
				if(inp.e==1){
					p.dotted = _obj.space.paper.circle(inp.cx,inp.cy,inp.r);
					p.solid = _obj.space.paper.circle(inp.cx,inp.cy,inp.r);
				}else{
					var path = "m "+inp.cx+","+inp.cy+" "+makeOrbitPath(inp.r,inp.e,inp.i);
					p.dotted = _obj.space.paper.path(path);
					p.solid = _obj.space.paper.path(path);
				}
			}

			// Make the satellite
			if(inp.period){
				p.satellite = _obj.space.paper.circle(inp.cx,inp.cy,4).attr({ 'fill': inp.color, 'stroke': 0 });
				if(inp.key!="ES2") p.anim = p.satellite.animateAlong((inp.orbit ? inp.orbit : p.dotted), inp.period, Infinity, inp.orbitdir, inp.z);
			}

			p.dotted.attr({ stroke: inp.color,'stroke-dasharray': '-','stroke-width':inp.stroke.off });
			p.solid.attr({ stroke: inp.color,'opacity':0.1,'stroke-width': 8 });

			// Add mouseover events
			var on = function(){ $('#orbits').css('cursor','pointer'); this.dotted.attr({"stroke-width": (this.selected ? inp.stroke.selected : inp.stroke.on)}); };
			var off = function(){ $('#orbits').css('cursor','default'); this.dotted.attr({"stroke-width": (this.selected ? inp.stroke.selected : inp.stroke.off)}); };
			p.solid.hover(on, off, p, p);
			p.satellite.hover(on, off, p, p);
			p.solid.click(function(){ _obj.selectOrbit(inp.key); },p,p);
			p.satellite.click(function(){ _obj.selectOrbit(inp.key); },p,p);

			// Store zoom level this applies to
			p.zoom = _obj.space.zoom+0;
			p.hide = function(){
				hide(p.dotted);
				hide(p.solid);
				hide(p.satellite);
			}
			p.show = function(){
				show(p.dotted);
				show(p.solid);
				show(p.satellite);
			}

			return p;
		}

		if(!this.space.E || !this.space.M || !this.space.scale) return this;
		
		if(this.space.zoom == 0){
			for(var o in this.data.orbit){
				if(this.orbits[o] && this.orbits[o].zoom == this.space.zoom && !this.space.orbits[o]){
					if(o=="HEO"){
						dx = -this.space.E.r*1.2;
						dy = -this.space.E.r*0.35;
					}else{
						dx = 0;
						dy = 0;
					}
					if(!this.orbits[o].r) this.orbits[o].r = this.space.E.r*(1+this.data.orbit[o].altitude.value/this.space.E.radius);
					period = this.convertValue(this.data.orbit[o].period,'hours');
					this.space.orbits[o] = makeOrbit({key:o,period:period.value*3*1000,r:this.orbits[o].r,cx:(this.space.E.x+dx),cy:(this.space.E.y+dy),color:this.orbits[o].color,e:this.orbits[o].ellipticity,i:this.orbits[o].inclination,z:this.orbits[o].z});
				}
			}
		}else if(this.space.zoom == 1){
			if(!this.space.Moonorbit){
				this.space.Moonorbit = this.space.paper.path("M "+this.space.E.x+","+this.space.E.y+" "+makeOrbitPath(this.space.M.o*this.space.scale[1],1)).attr({ stroke:'#606060','stroke-dasharray': '-','stroke-width':1.5 });
				this.space.Moon = this.space.paper.circle(this.space.E.x - this.space.M.o*this.space.scale[1]*Math.cos(Math.PI/6),this.space.E.y - this.space.M.o*this.space.scale[1]*Math.sin(Math.PI/6),this.space.M.r).attr({ 'fill': '#606060', 'stroke': 0 });
				var r = 9;
				if(!this.space.orbits["ETR"] && this.data.orbit["ETR"]){
					period = this.convertValue(this.data.orbit["ETR"].period,'days');
					this.space.Earthorbit = this.space.paper.path("M "+(this.space.E.x-r)+",0 q "+(r*2)+","+(this.space.height/2)+" 0,"+(this.space.height)).attr({ stroke:'#606060','stroke-dasharray': '-','stroke-width':1.5 });
					this.space.orbits["ETR"] = makeOrbit({key:"ETR",period:period.value*1000,r:1,cx:(this.space.E.x-r*0.78),cy:(this.space.E.y+2.1*this.space.M.o*this.space.scale[1]),color:this.orbits["ETR"].color});
				}
				if(!this.space.orbits["EM2"] && this.data.orbit["EM2"]){
					this.space.Moonlagrangian = this.space.paper.path("M "+this.space.E.x+","+this.space.E.y+" "+makeOrbitPath(this.space.M.o*this.space.scale[1]*440000/380000,1)).attr({ stroke:'#000000','stroke-dasharray': '-','stroke-width':0.5,'opacity':0.01 });
					period = this.convertValue(this.data.orbit["EM2"].period,'days');
					this.space.Moon.animateAlong(this.space.Moonorbit, period.value*1000, Infinity,-1);
					this.space.orbits["EM2"] = makeOrbit({key:"EM2",period:period.value*1000,orbit:this.space.Moonlagrangian,orbitdir:-1,r:this.space.M.o*((440000/380000)-1)*this.space.scale[1],cx:(this.space.E.x - this.space.M.o*this.space.scale[1]*Math.cos(Math.PI/6)),cy:(this.space.M.o*this.space.scale[1]*Math.sin(Math.PI/6)),color:this.orbits["EM2"].color,e:1,i:0});
					this.space.orbits["EM2"].dotted.animateAlong(this.space.Moonorbit, period.value*1000, Infinity,-1);
					this.space.orbits["EM2"].solid.animateAlong(this.space.Moonorbit, period.value*1000, Infinity,-1);
				}
				if(!this.space.orbits["ES2"] && this.data.orbit["ES2"]){
					period = this.convertValue(this.data.orbit["ES2"].period,'days');
					this.space.orbits["ES2"] = makeOrbit({key:"ES2",period:period.value*1000,r:9,cx:(this.space.E.x + 4*this.space.M.o*this.space.scale[1]),cy:this.space.E.y,color:this.orbits["ES2"].color});
				}
				var m = this.space.M.o*this.space.scale[1];
				var s = 0.3;
				var fs = parseInt(this.space.el.css('font-size'));
				if(!this.space.labels) this.space.labels = {};
				if(!this.space.labels.sun){
					this.space.labels.sun = {
						'zoom': 1,
						'arrow': this.space.paper.path("M "+(this.space.E.x - 4*m)+","+this.space.E.y+" l "+(s*m)+',-'+(s*0.3*m)+' q '+(-s*0.3*m)+','+(s*0.3*m)+' 0,'+(s*0.6*m)+' z M '+(this.space.E.x - 4*m + s*0.85*m)+","+(this.space.E.y-s*0.05*m)+' l '+(s*m*1.5)+','+(-s*0.05*m)+' l 0,'+(s*0.2*m)+' l '+(-s*m*1.5)+','+(-s*0.05*m)+' z').attr({'fill':'#fac900','stroke':0}),
						'label': this.space.paper.text((this.space.E.x - 4*m + 2.5*s*m),(this.space.E.y),this.phrases.designer.orbit.diagram.sun).attr({'fill':'#fac900','stroke':0, 'text-anchor': 'start', 'font-size': fs })
					}
				}
				if(!this.space.labels.earthorbit && this.data.orbit["ETR"]){
					this.space.labels.earthorbit = {
						'zoom': 1,
						'arrow': this.space.paper.path("M "+(this.space.E.x)+","+(this.space.E.y-2.1*m)+' l -'+(s*0.3*m)+','+(s*m)+' q '+(s*0.3*m)+','+(-s*0.3*m)+' '+(s*0.6*m)+',0 z M '+(this.space.E.x - s*0.05*m)+","+(this.space.E.y - 2.1*m + s*0.85*m)+' l '+(-s*0.05*m)+','+(s*m*1.5)+' l '+(s*0.2*m)+',0 l '+(-s*0.05*m)+','+(-s*m*1.5)+' z').attr({'fill':'#999999','stroke':0}),
						'label': this.space.paper.text((this.space.E.x+s*0.3*m),(this.space.E.y - 2*m + s*m),this.phrases.designer.orbit.diagram.earthorbit).attr({'fill':'#999999','stroke':0, 'text-anchor': 'start', 'font-size': fs })
					}
				}
			}
		}

		for(var o in this.space.orbits){
			if(this.space.orbits[o].zoom!=this.space.zoom) hide(this.space.orbits[o]);
			else show(this.space.orbits[o]);
			if(this.space.zoom == 0){
				hide(this.space.Moonorbit);
				hide(this.space.Moon);
			}else{
				show(this.space.Moonorbit);			
				show(this.space.Moon);
			}
			if(this.space.orbits["EM2"]){
				if(this.space.zoom == 0){
					hide(this.space.Moonlagrangian);
					hide(this.space.Earthorbit);
				}else{
					show(this.space.Moonlagrangian);
					show(this.space.Earthorbit);
				}
			}
		}
		for(var l in this.space.labels){
			if(this.space.labels[l].zoom!=this.space.zoom){
				hide(this.space.labels[l].arrow);
				hide(this.space.labels[l].label);
			}else{
				show(this.space.labels[l].arrow);
				show(this.space.labels[l].label);
			}
		}

		// Scale the Earth. SVG size is 48px so we scale that first;
		var scale = this.space.E.r/48;
		// If we are in Earth-Moon view we scale the Earth so that it is visible
		if(this.space.scale[this.space.zoom] < 1) scale *= this.space.scale[this.space.zoom]*10;
		// Now scale the path
		if(this.space.Earth) transformer(this.space.Earth,['S',scale,scale,this.space.E.x,this.space.E.y]);
		
		return this;
	}
	
	SpaceTelescope.prototype.updateProposal = function(){
		this.log('updateProposal')
		$('.printable').remove();

		// First we will autocomplete fields
		
		// As we loop over instruments we find the wavelength coverage
		var lambdamax = {};
		var lambdamin = {};
		var w;
		// Complete instruments
		if(this.choices.instruments && this.choices.instruments.length > 0){
			var str_instruments = "";
			for(var i = 0; i < this.choices.instruments.length; i++){
				w = this.choices.instruments[i].wavelength;
				v = this.getInstrument({'wavelength':this.choices.instruments[i].wavelength,'type':this.choices.instruments[i].type})
				str_instruments += ''+this.choices.instruments[i].name+' - '+v.wavelength+' '+v.type+'\n';
				if(this.data.wavelengths[w].min){
					if(!lambdamin.value || this.data.wavelengths[w].min.value < lambdamin.value) lambdamin = this.copyValue(this.data.wavelengths[w].min);
				}
				if(this.data.wavelengths[w].max){
					if(!lambdamax.value || this.data.wavelengths[w].max.value > lambdamax.value) lambdamax = this.copyValue(this.data.wavelengths[w].max);
				}
			}
			$('#proposal_instruments').val(str_instruments)
		}

		// Complete mirror
		if(this.choices.mirror){
			$('#proposal_mirror').val(this.choices.mirror);
			if(this.settings.mode!="advanced"){
				var D = this.data.mirror[this.choices.mirror].diameter;
				$('#proposal_reslow').val(htmlDecode(this.formatValue(this.makeValue(1.22*lambdamin.value/D.value,'degrees'))))
				$('#proposal_reshigh').val(htmlDecode(this.formatValue(this.makeValue(1.22*lambdamax.value/D.value,'degrees'))))
			}
		}
		
		// Complete cooling section
		if(this.choices.temperature){
			$('#proposal_reqtemp').val(this.formatValue(this.choices.instrument.temp));
			$('#proposal_temp').val(this.formatValue(this.choices.temperature));
		}

		// Complete mass section
		if(this.table.mass_total){
			$('#proposal_mass').val(this.formatValue(this.table.mass_total.value));
			$('#proposal_mass_satellite').val(this.formatValue(this.table.mass_total.list.mass_satellite.value));
			$('#proposal_mass_mirror').val(this.formatValue(this.table.mass_total.list.mass_mirror.value));
			$('#proposal_mass_cooling').val(this.formatValue(this.table.mass_total.list.mass_cooling_total.value));
			$('#proposal_mass_instruments').val(this.formatValue(this.table.mass_total.list.mass_instruments.value));
		}

		// Complete orbit section
		if(this.choices.orbit){
			$('#proposal_orbit').val(this.phrases.designer.orbit.options[this.choices.orbit].label);
			$('#proposal_distance').val(this.formatValue(this.data.orbit[this.choices.orbit].altitude));
			if(this.settings.mode!="advanced"){
				$('#proposal_period').val(this.formatValue(this.data.orbit[this.choices.orbit].period));
				$('#proposal_fuel').val(this.formatValue(this.data.orbit[this.choices.orbit].fuellife));
			}
		}
		if(this.choices.mission){
			$('#proposal_duration').val(this.formatValue(this.copyValue(this.data.mission[this.choices.mission].life)))
		}

		// Complete launch vehicle section
		if(this.choices.vehicle){
			$('#proposal_vehicle').val(this.phrases.designer.vehicle.options[this.choices.vehicle].label);
			$('#proposal_operator').val(this.phrases.operator[this.data.vehicle[this.choices.vehicle].operator].label);
			$('#proposal_launchmass').val(this.formatValue((this.data.orbit[this.choices.orbit].LEO ? this.data.vehicle[this.choices.vehicle].mass.LEO : this.data.vehicle[this.choices.vehicle].mass.GTO)));
			$('#proposal_launchsize').val(this.formatValue(this.data.vehicle[this.choices.vehicle].diameter));
		}
		if(this.choices.site){
			$('#proposal_site').val(this.phrases.designer.site.options[this.choices.site].label);
		}

		if(this.table){
			$('#proposal_cost').val(htmlDecode(this.formatValue(this.negativeValue(this.table.cost_available.list.cost_total.value))));
			$('#proposal_cost_satellite').val(htmlDecode(this.formatValue(this.negativeValue(this.table.cost_available.list.cost_dev_total.list.cost_dev_satellite.value))));
			$('#proposal_cost_mirror').val(htmlDecode(this.formatValue(this.negativeValue(this.table.cost_available.list.cost_dev_total.list.cost_dev_mirror.value))));
			$('#proposal_cost_cooling').val(htmlDecode(this.formatValue(this.negativeValue(this.table.cost_available.list.cost_dev_total.list.cost_dev_cooling.value))));
			$('#proposal_cost_instruments').val(htmlDecode(this.formatValue(this.negativeValue(this.table.cost_available.list.cost_dev_total.list.cost_dev_instruments.value))));
			$('#proposal_cost_dev').val(htmlDecode(this.formatValue(this.negativeValue(this.table.cost_available.list.cost_dev_total.value))));
			$('#proposal_cost_launch').val(htmlDecode(this.formatValue(this.negativeValue(this.table.cost_available.list.cost_operations_total.list.cost_operations_launch.value))));
			$('#proposal_cost_ground').val(htmlDecode(this.formatValue(this.negativeValue(this.table.cost_available.list.cost_operations_total.list.cost_operations_ground.value))));
			$('#proposal_cost_operations').val(htmlDecode(this.formatValue(this.negativeValue(this.table.cost_available.list.cost_operations_total.value))));
		}

		if(this.proposalCompleteness()!=0){
			// Show print button
			$('.doc').after('<div class="printable bigpadded"><a href="#" class="button fancybtn">'+this.phrases.designer.proposal.print+'</a></div>');
		}
		return this;
	}

	SpaceTelescope.prototype.proposalCompleteness = function(){

		this.log('proposalCompleteness')

		var level = 0;
		var inputs = $('.doc').find('input');
		var textarea = $('.doc').find('textarea');
		var n = inputs.length+textarea.length;
		for(var i = 0; i < inputs.length ; i++){
			if($(inputs[i]).val()!="") level++;
		}
		for(var i = 0; i < textarea.length ; i++){
			if($(textarea[i]).val()!="") level++;
		}
		return level/n;
	}

	SpaceTelescope.prototype.printProposal = function(){
		this.log('printProposal')

		var html = $('.doc').eq(0).html();
		html = html.replace(/<label[^\>]*>[^\<]*<\/label>/g,'').replace(/<input [^\>]*id=\"([^\"]*)\"[^\>]*>/g,function(match,p1){ var v = $('#'+p1).val(); return (v!='' ? '<span class="userinput">'+v+'</span>' : '<span class="emptyinput">BLANK</span>'); }).replace(/<textarea [^\>]*id=\"([^\"]*)\"[^\>]*>/g,function(match,p1){ var v = $('#'+p1).val(); return (v!='' ? '<span class="userinput">'+v+'</span>' : '<span class="emptyinput">BLANK</span>'); });
		var w = window.open('', '', 'width='+$(window).width()+',height='+$(window).height()+',resizeable,scrollbars');
		w.document.write('<!DOCTYPE html><html><head><link type="text/css" href="css/fonts.css" media="all" rel="stylesheet"><link type="text/css" href="css/style.css" media="all" rel="stylesheet"><script>function onload(){ window.print(); }</script></head><body onload="onload()"><div id="main" class="bigpadded"><div class="doc">'+html+'</div></div></body></html>');
		w.document.close(); // needed for chrome and safari
		return this;
	}

	SpaceTelescope.prototype.updateSidePanels = function(){

		if(this.choices.mirror || this.choices.hascooling || this.choices.instruments){ this.makeSatellite(); $('#sidebar .satellite.panel').show(); }
		else $('#sidebar .satellite.panel').hide();

		if(this.choices.vehicle) $('#sidebar .vehicle.panel').html('<div class="image"><img src="'+this.data.vehicle[this.choices.vehicle].img+'" /></div><div class="info"><div>'+this.phrases.designer.vehicle.options[this.choices.vehicle].label+'</div><div>'+this.phrases.designer.vehicle.diameter+' '+this.formatValueSpan(this.data.vehicle[this.choices.vehicle].diameter)+'</div><div>'+this.phrases.designer.vehicle.massLEO+' '+this.formatValueSpan(this.data.vehicle[this.choices.vehicle].mass.LEO)+'</div><div>'+this.phrases.designer.vehicle.massGTO+' '+this.formatValueSpan(this.data.vehicle[this.choices.vehicle].mass.GTO)+'</div><div>'+this.phrases.designer.vehicle.operator+' '+this.phrases.operator[this.data.vehicle[this.choices.vehicle].operator].label+'</div></div>').show();
		else $('#sidebar .vehicle.panel').hide();

		if(this.choices.site){
			html = '<img src="images/worldmap.png" />';
			var lat = this.data.site[this.choices.site].latitude;
			var lon = this.data.site[this.choices.site].longitude;
			if(!lat && !lon){
				lat = 34;
				lon = -116;
			}
			html += '<a href="#" class="launchsite '+this.choices.site+'" title="'+this.phrases.designer.site.options[this.choices.site].label+'" style="left:'+Math.round(100*(lon+180)/360)+'%;top:'+Math.round(100*(90-lat)/180)+'%"></a>';
			$('#sidebar .site.panel').html(html).show();
		}else $('#sidebar .site.panel').hide();

		if(this.choices.orbit) $('#sidebar .orbit.panel').html('<img src="'+this.data.orbit[this.choices.orbit].img+'" />').show();
		else $('#sidebar .orbit.panel').hide();

		return this;
	}

	// Update the text of a specific dropdown select box
	SpaceTelescope.prototype.updateDropdown = function(dropdown){

		var options = "";
		var el,o,v;
		el = $('#'+dropdown);
		if(el.length == 0) return this;
		o = el.find('option');
		this.log('updateDropdown')

		if(dropdown=="mirror_size"){
			if(this.phrases.designer.satellite.options.diameter.placeholder) options = '<option value="">'+this.phrases.designer.satellite.options.diameter.placeholder+'</option>';
			for(var m in this.data.mirror) options += '<option value="'+m+'">'+this.formatValue(this.data.mirror[m].diameter)+'</option>';
			el.html(options);
		}else if(dropdown=="instruments"){
			// Only add select label for advanced mode
			if(this.phrases.designer.instruments.options.instrument["none"] && this.settings.mode=="advanced") options = '<option value="">'+this.phrases.designer.instruments.options.instrument["none"].label+'</option>';
			for(var m in this.data.instrument.options){
				v = this.phrases.designer.instruments.options.instrument[m].label;
				options += '<option value="'+m+'">'+v+'</option>';
			}
			el.html(options);

			// Now select default option in basic mode
			if(this.settings.mode!="advanced") $('#instruments option:first-child').attr('selected','selected');
			this.displayInstruments();
		}else if(dropdown=="wavelengths"){
			if(this.phrases.wavelengths["none"].label) options = '<option value="">'+this.phrases.wavelengths["none"].label+'</option>';
			for(var m in this.data.wavelengths){
				v = this.phrases.wavelengths[m].label;
				options += '<option value="'+m+'">'+v+'</option>';
			}
			el.html(options);
		}else if(dropdown=="mission_duration"){
			if(this.phrases.designer.orbit.duration["none"]) options = '<option value="">'+this.phrases.designer.orbit.duration["none"]+'</option>';
			for(var m in this.data.mission){
				v = this.formatValue(this.data.mission[m].life);
				options += '<option value="'+m+'">'+v+'</option>';
			}
			el.html(options);
		}else if(dropdown=="mission_orbit"){
			if(this.phrases.designer.orbit.orbit["none"]) options = '<option value="">'+this.phrases.designer.orbit.orbit["none"]+'</option>';
			for(var m in this.data.orbit){
				options += '<option value="'+m+'">'+this.phrases.designer.orbit.options[m].label+'</option>';
			}
			el.html(options);
		}else if(dropdown=="cooling_temperature"){
			if(this.data.cooling.temperature){
				for(var m in this.data.cooling.temperature){
					v = htmlDecode(this.formatValue(this.data.cooling.temperature[m].temperature));
					options += '<option value="'+m+'">'+v+'</option>';
				}
				el.html(options);
			}
		}else if(dropdown=="site"){
			if(this.phrases.designer.site.hint) options = '<option value="">'+this.phrases.designer.site.hint+'</option>';
			for(var m in this.data.site){
				if(this.phrases.designer.site.options[m]){
					v = this.phrases.designer.site.options[m].label
					options += '<option value="'+m+'">'+v+'</option>';
				}
			}
			el.html(options);
		}else if(dropdown=="cooling_cryogenic"){
			for(var m in this.data.cooling.cryogenic){
				v = (this.phrases.designer.cooling.options.cryogenic.options[m] ? this.phrases.designer.cooling.options.cryogenic.options[m] : this.formatValue(this.data.cooling.cryogenic[m].life));
				options += '<option value="'+m+'">'+v+'</option>';
			}
			el.html(options);
		}
		return this;
	}
	
	SpaceTelescope.prototype.updateLanguage = function(){
		this.log('updateLanguage')
		if(!this.phrases || !this.data) return this;

		var d = this.phrases;
		var html,i,r,li,rk;
		
		// Update page title (make sure we encode the HTML entities)
		if(d.title) document.title = htmlDecode(d.title);

		// Update title
		$('h1').text(d.title);

		// Set language direction via attribute and a CSS class
		$('body').attr('dir',(d.language.alignment=="right" ? 'rtl' : 'ltr')).removeClass('ltr rtl').addClass((d.language.alignment=="right" ? 'rtl' : 'ltr'));


		// Update Designer

		// Update objectives
		if(this.scenario){
			if($('#designer_objectives .banner').length==0) $('#designer_objectives .intro').before('<div class="banner"></div>');
			$('#designer_objectives .banner').html('<div class="title">'+this.scenario.name+'</div>');
			if(this.scenario.image && this.scenario.image.banner) $('#designer_objectives .banner').css('background-image','url('+this.scenario.image.banner+')');
			if(d.designer.objectives.intro) $('#designer_objectives .intro').html('<p><strong>'+d.scenarios.mission+'</strong> &quot;'+this.formatScenario(this.scenario)+'&quot;</p>'+(this.scenario.funder ? d.designer.objectives.intro : d.designer.objectives.intronofunder).replace(/%TITLE%/,this.scenario.name).replace(/%FUNDER%/,this.scenario.funder)).addClass('bigpadded');
		}

		// Update the satellite section
		$('#designer_satellite .options .mirror_diameter label').html(d.designer.satellite.options.diameter.label)
		this.updateDropdown('mirror_size');
		$('#designer_satellite .options .mirror_deployable label').html(d.designer.satellite.options.deployable.label);
		$('#designer_satellite .options .mirror_uv label').html(d.designer.satellite.options.uv.label);
		if(d.designer.satellite.intro) $('#designer_satellite .intro').html(d.designer.satellite.intro).addClass('bigpadded');
		this.updateToggle({ "id": "mirror_deployable_no", "label": this.phrases.designer.satellite.options.deployable.no }, { "id": "mirror_deployable_yes", "label": this.phrases.designer.satellite.options.deployable.yes }, this.phrases.designer.satellite.options.deployable.label);
		this.updateToggle({ "id": "mirror_uv_no", "label": this.phrases.designer.satellite.options.uv.no }, { "id": "mirror_uv_yes", "label": this.phrases.designer.satellite.options.uv.yes }, this.phrases.designer.satellite.options.uv.label);

		// Update the instruments section
		this.updateDropdown('instruments');
		this.updateDropdown('wavelengths');
		$('#designer_instruments .options label').html(d.designer.instruments.options.label);
		$('#designer_instruments .options input#instrument_name').attr('placeholder',d.designer.instruments.options.name);
		$('#designer_instruments .options a.add_instrument').attr('title',d.designer.instruments.options.add);
		$('#designer_instruments .options a.add_instrument span').html(d.designer.instruments.options.add)
		if(d.designer.instruments.intro) $('#designer_instruments .intro').html(d.designer.instruments.intro.replace(/%MAX%/,this.data.instrument.maxsize.length)).addClass('bigpadded');

		// Update the cooling section
		if(d.designer.cooling.intro) $('#designer_cooling .intro').html(d.designer.cooling.intro).addClass('bigpadded');
		$('#designer_cooling .options label[for=hascooling]').html(d.designer.cooling.enable.label);
		this.updateToggle({ "id": "cooling_no", "label": d.designer.cooling.enable.no }, { "id": "cooling_yes", "label": d.designer.cooling.enable.yes }, this.phrases.designer.cooling.enable.label);
		if(this.data.cooling.temperature){
			this.updateDropdown('cooling_temperature');
			$('#designer_cooling .options label[for=cooling_temperature]').html(d.designer.cooling.options.temperature.label);
		}
		if(this.data.cooling.passive){
			html = "";
			this.updateToggle({ "id": "cooling_passive_no", "label": this.phrases.designer.cooling.options.passive.options.no },{ "id": "cooling_passive_yes", "label": this.phrases.designer.cooling.options.passive.options.yes }, this.phrases.designer.cooling.options.passive.label);
			$('#designer_cooling .options label[for=cooling_passive]').html(d.designer.cooling.options.passive.label);
		}
		if(this.data.cooling.active){
			html = "";
			this.updateToggle({ "id": "cooling_active_no", "label": this.phrases.designer.cooling.options.active.options.no },{ "id": "cooling_active_yes", "label": this.phrases.designer.cooling.options.active.options.yes }, this.phrases.designer.cooling.options.active.label);
			$('#designer_cooling .options label[for=cooling_active]').html(d.designer.cooling.options.active.label);
		}
		if(this.data.cooling.cryogenic){
			this.updateDropdown('cooling_cryogenic');
			$('#designer_cooling .options label[for=cooling_cryogenic]').html(d.designer.cooling.options.cryogenic.label);
		}

		// Update the launch vehicle section
		i = 0;
		rk = d.designer.vehicle;
		var imgs = "";
		var n = 0;
		for(var l in this.data.vehicle) n++;
		var w = 100/n;
		for(var l in this.data.vehicle){
			li = $('#designer_vehicle .options li').eq(i);
			li.attr({'data':l}).css({'width':w+'%'});
			r = this.data.vehicle[l];
			li.find('.image img').attr({'src':r.img,'alt':rk.options[l].label,'title':rk.options[l].label});
			li.find('.selector label').html(rk.options[l].label);
			li.find('.rocket').html(rk.options[l].label);
			li.find('.operator img').attr({'src':this.data.operator[r.operator].img,'alt':d.operator[r.operator].label, 'title':d.operator[r.operator].label});
			li.find('.details .operator strong').html(rk.operator);
			li.find('.details .operator .value').html(d.operator[r.operator].label);
			if(r.height){
				li.find('.height strong').html(rk.height);
				this.updateValue(li.find('.height .value'),r.height);
			}

			li.find('.diameter strong').html(rk.diameter);
			this.updateValue(li.find('.diameter .value'),r.diameter);

			li.find('.currency strong').html(rk.cost);
			this.updateValue(li.find('.currency .value'),r.cost);

			li.find('.massLEO strong').html(rk.massLEO);
			this.updateValue(li.find('.massLEO .value'),r.mass.LEO);
			li.find('.massGTO strong').html(rk.massGTO);
			this.updateValue(li.find('.massGTO .value'),r.mass.GTO);

			if(r.risk){
				li.find('.risk strong').html(rk.risk);
				this.updateValue(li.find('.risk .value'),(r.risk*100)+'%');
			}
			li.find('.sites strong').html(rk.sites);
			html = '';
			for(var s = 0; s < r.sites.length; s++) html += ''+d.designer.site.options[r.sites[s]].label+'<br />';
			this.updateValue(li.find('.sites .value'),html);

			li.find('input').attr('value',l);
			li.find('.button').html(rk.select);
			
			i++;
		}
		if(d.designer.vehicle.intro) $('#designer_vehicle .intro').html(d.designer.vehicle.intro).addClass('bigpadded');


		// Update the site section
		var pins = "";
		this.updateDropdown('site');
		var opts = '<option value="">'+d.designer.site.hint+'</option>';
		for(var s in this.data.site){
			var lat = this.data.site[s].latitude;
			var lon = this.data.site[s].longitude;
			opts += '<option value="'+s+'">'+d.designer.site.options[s].label+'</option>';
			if(!lat && !lon){
				lat = 34;
				lon = -116;
			}
			pins += '<a href="#" class="launchsite '+s+'" data="'+s+'" title="'+d.designer.site.options[s].label+'" style="left:'+Math.round(100*(lon+180)/360)+'%;top:'+Math.round(100*(90-lat)/180)+'%"></a>';
		}
		// Remove existing launch site pins
		$('#designer_site .worldmap .launchsite').remove();
		$('#designer_site .worldmap').append(pins);
		$('#designer_site .options label').html(d.designer.site.hint);
		if(d.designer.site.intro) $('#designer_site .intro').html(d.designer.site.intro).addClass('bigpadded');

		// Update the orbit section
		$('#designer_orbit .options label[for=mission_duration]').html(d.designer.orbit.duration.label);
		this.updateDropdown('mission_duration');
		$('#designer_orbit .options label[for=mission_orbit]').html(d.designer.orbit.orbit.label);
		this.updateDropdown('mission_orbit');


		// Update the proposal section
		var _book = (d.designer.proposal.labels ? d.designer.proposal.labels : {});
		String.prototype.formify = function(key,t,name,value,label){
			if(!label && _book[key]) label = _book[key];
			if(label) label = '<label for="'+name+'">'+label+'</label>';
			else label = '';
			if(!value) value = "";
			if(t=="text") var form = '<input type="text" name="'+name+'" id="'+name+'" value="'+value+'" >';
			else if(t=="textarea") var form = '<textarea name="'+name+'" id="'+name+'">'+value+'</textarea>';
			return this.replace("%"+key+"%",label+form,"g");
		}
		var str = d.designer.proposal.doc;
		$('#designer_proposal .options .doc').html(str.replace(/%FUNDER%/g,'Funder').replace(/%DATE%/,(new Date()).toDateString()).formify("TO",'text','proposal_to').formify('NAME','text','proposal_name').formify('AIM','textarea','proposal_aim').formify('PREVIOUS','text','proposal_previous').formify("ADVANCE",'textarea','proposal_advance').formify("INSTRUMENTS",'textarea','proposal_instruments').formify('GOALS','textarea','proposal_goal').formify('RESLOW','text','proposal_reslow').formify('RESHIGH','text','proposal_reshigh').formify('MIRROR','text','proposal_mirror').formify('REQTEMPERATURE','text','proposal_reqtemp').formify('TEMPERATURE','text','proposal_temp').formify('MASS','text','proposal_mass').formify('MASSSATELLITE','text','proposal_mass_satellite').formify('MASSMIRROR','text','proposal_mass_mirror').formify('MASSCOOLING','text','proposal_mass_cooling').formify('MASSINSTRUMENTS','text','proposal_mass_instruments').formify('ORBIT','text','proposal_orbit').formify('DISTANCE','text','proposal_distance').formify('PERIOD','text','proposal_period').formify('FUEL','text','proposal_fuel').formify('DURATION','text','proposal_duration').formify('VEHICLE','text','proposal_vehicle').formify('OPERATOR','text','proposal_operator').formify('SITE','text','proposal_site').formify('LAUNCHMASS','text','proposal_launchmass').formify('LAUNCHSIZE','text','proposal_launchsize').formify('COST','text','proposal_cost').formify('COSTSATELLITE','text','proposal_cost_satellite').formify('COSTMIRROR','text','proposal_cost_mirror').formify('COSTCOOLING','text','proposal_cost_cooling').formify('COSTINSTRUMENTS','text','proposal_cost_instruments').formify('COSTDEV','text','proposal_cost_dev').formify('COSTLAUNCH','text','proposal_cost_launch').formify('COSTGROUND','text','proposal_cost_ground').formify('COSTOPERATIONS','text','proposal_cost_operations'));


		// Update designer toggle buttons
		for(var i = 0; i < this.sections.length; i++){
			if(d.designer[this.sections[i]]) $('.toggle'+this.sections[i]).text(d.designer[this.sections[i]].label).attr('title',(d.designer[this.sections[i]].hint ? d.designer[this.sections[i]].hint.replace(/<([^>]*)>/g,'') : ''));	// remove any HTML that has been added
		}

		// Update menu items
		$('.togglemenu').attr('title',d.ui.menu.title);
		$('#menu ul li').each(function(i){
			var id = $(this).attr('data');
			$(this).find('a').attr('title',d.ui.menu[id].title).find('span').html(d.ui.menu[id].label)
		})

		var toggles = ['warnings','errors','success','time','cost','mass','science'];
		for(var i = 0 ; i < toggles.length; i++){
			if(d.ui[toggles[i]]) $('.toggle'+toggles[i]).attr('title',d.ui[toggles[i]].title);
			if(d.ui.summary[toggles[i]]) $('.toggle'+toggles[i]).attr('title',d.ui.summary[toggles[i]].title);
		}

		// Update introduction text
		$('#introduction').html(d.intro.about);
		$('#introduction').append('<div class="centre"><a href="#scenarios" class="button fancybtn">'+d.intro.button+'</a></div>');
		$('#introduction').append('<div class="centre toppadded">'+this.buildToggle("togglemode",{ "value": "no", "id": "mode_basic", "checked": (this.settings.mode!="advanced" ? true : false) },{ "value": "yes", "id": "mode_advanced", "checked": (this.settings.mode=="advanced" ? true : false) })+'</div>');
		this.updateToggle({ "id": "mode_basic", "label": this.phrases.modes.basic }, { "id": "mode_advanced", "label": this.phrases.modes.advanced }, this.phrases.modes.label);
		
		var li = '';
		for(var i = 0; i < this.scenarios.length; i++) li += '<li><div class="padded">'+(this.scenarios[i].image && this.scenarios[i].image.banner ? '<img src="'+this.scenarios[i].image.banner+'"'+(this.scenarios[i].image.alt ? 'alt="'+this.scenarios[i].image.alt+'"' : '')+' style="width: 100%;" />':'')+'<h3>'+this.scenarios[i].name+'</h3><p>'+this.formatScenario(this.scenarios[i])+'</p><a href="#designer_objectives" class="button" title="'+this.scenarios[i].name+'" data="'+i+'">Choose this mission<!--LANGUAGE--></a></div></li>';
		$('#scenariolist').html(li);
		$('#scenarios h2').html(d.scenarios.title);
		$('#scenarios p.about').html(d.scenarios.intro);

		
		// Update values to be consistent with current user preferences
		this.updateUnits();

		// Update Warning/Error titles
		$('#messages h3.warning .title').text(this.phrases.ui.warning.title);
		$('#messages h3.error .title').text(this.phrases.ui.error.title);


		// Update launch section
		$('.togglelaunch a').text(this.phrases.launch.label).attr('title',(this.phrases.launch.hint ? this.phrases.launch.hint : ''));



		// Update summary table labels
		var s = d.ui.summary;
		this.table.success.label = s.success.title;
		this.table.success.list.success_orbit.label = s.success.orbit;
		this.table.success.list.success_site.label = s.success.site;
		this.table.success.list.success_vehicle.label = s.success.vehicle;
		this.table.success.list.success_deploy.label = s.success.deploy;
		this.table.success.list.success_cooling.label = s.success.cooling;
		this.table.success.list.success_instruments.label = s.success.instruments;
		this.table.success.list.success_mission.label = s.success.mission;
		this.table.cost_available.label = s.cost.title;
		this.table.cost_available.list.cost_initial.label = s.cost.initial;
		this.table.cost_available.list.cost_dev_total.label = s.cost.dev.title;
		this.table.cost_available.list.cost_dev_total.list.cost_dev_satellite.label = s.cost.dev.satellite;
		this.table.cost_available.list.cost_dev_total.list.cost_dev_mirror.label = s.cost.dev.mirror;
		this.table.cost_available.list.cost_dev_total.list.cost_dev_cooling.label = s.cost.dev.cooling;
		this.table.cost_available.list.cost_dev_total.list.cost_dev_instruments.label = s.cost.dev.instruments;
		this.table.cost_available.list.cost_operations_total.label = s.cost.operations.title;
		this.table.cost_available.list.cost_operations_total.list.cost_operations_launch.label = s.cost.operations.launch;
		this.table.cost_available.list.cost_operations_total.list.cost_operations_ground.label = s.cost.operations.ground;
		this.table.cost_available.list.cost_total.label = s.cost.total;
		this.table.cost_available.list.cost_available.label = s.cost.available;
		this.table.time_dev_total.label = s.time.title;
		this.table.time_dev_total.list.time_dev_total.label = s.time.dev.title;
		this.table.time_dev_total.list.time_dev_total.list.time_dev_satellite.label = s.time.dev.satellite;
		this.table.time_dev_total.list.time_dev_total.list.time_dev_mirror.label = s.time.dev.mirror;
		this.table.time_dev_total.list.time_dev_total.list.time_dev_cooling.label = s.time.dev.cooling;
		this.table.time_dev_total.list.time_dev_total.list.time_dev_instruments.label = s.time.dev.instruments;
		this.table.time_dev_total.list.time_mission.label = s.time.mission;
		this.table.time_dev_total.list.time_cooling.label = s.time.cooling;
		this.table.time_dev_total.list.time_fuel.label = s.time.fuel;
		this.table.time_dev_total.list.time_observing.label = s.time.observing;
		this.table.mass_total.label = s.mass.title;
		this.table.mass_total.list.mass_satellite.label = s.mass.satellite;
		this.table.mass_total.list.mass_mirror.label = s.mass.mirror;
		this.table.mass_total.list.mass_cooling_total.label = s.mass.cooling.title;
		if(this.settings.mode=="advanced"){
			this.table.mass_total.list.mass_cooling_total.list.mass_cooling_passive.label = s.mass.cooling.passive;
			this.table.mass_total.list.mass_cooling_total.list.mass_cooling_cryo.label = s.mass.cooling.cryo;
			this.table.mass_total.list.mass_cooling_total.list.mass_cooling_active.label = s.mass.cooling.active;
		}
		this.table.mass_total.list.mass_instruments.label = s.mass.instruments;
		this.table.science_total.label = s.science.title;
		this.table.profile_total.label = s.profile.title;
		this.table.profile_total.list.profile_site.label = s.profile.site;
		this.table.profile_total.list.profile_vehicle.label = s.profile.vehicle;
		this.table.profile_total.list.profile_instruments.label = s.profile.instruments;
		this.table.profile_total.list.profile_mirror.label = s.profile.mirror;
		this.table.profile_total.list.profile_temperature.label = s.profile.temperature;
		this.table.profile_total.list.profile_orbit.label = s.profile.orbit;
		this.table.profile_total.list.profile_launch.label = s.profile.launch;
		this.table.profile_total.list.profile_end.label = s.profile.end;

		this.updateSummaryList();


		return this;
	}

	SpaceTelescope.prototype.getInstrument = function(value){

		var v = value;

		var cost = this.makeValue(0,'GBP');
		var mass = this.makeValue(0,'kg');
		var temp = this.makeValue(0,'K');
		var time = this.makeValue(0,'months');

		if(value.wavelength && this.data.wavelengths[value.wavelength]){
			var w = this.copyValue(this.data.wavelengths[value.wavelength]);
			if(w.cost) cost = w.cost;
			if(w.mass) mass = w.mass;
			if(w.temperature) temp = w.temperature;
			v.wavelength = this.phrases.wavelengths[value.wavelength].label;
		}
		if(value["type"] && this.data.instrument.options[value["type"]]){
			var t = this.copyValue(this.data.instrument.options[value["type"]]);
			if(t.multiplier && t.multiplier.cost) cost.value *= t.multiplier.cost;
			if(t.multiplier && t.multiplier.mass) mass.value *= t.multiplier.mass;
			if(t.devtime) time = t.devtime;
			v.type = this.phrases.designer.instruments.options.instrument[value["type"]].label;
		}
		v.cost = cost;
		v.mass = mass;
		v.temp = temp;
		v.time = time;

		return v;
	}

	// Show the detail panel for the area/value
	SpaceTelescope.prototype.buildRow = function(name,value,cls){
		return (!name && !value && !cls) ? '' : '<div'+(typeof cls==="string" ? ' class="'+cls+'"' : '')+'><strong>'+name+'</strong> '+this.formatValueSpan(value)+'</div>';
	}

	// Show the detail panel for the area/value
	SpaceTelescope.prototype.showDetails = function(area,value){

		this.log('showDetails')
		var html = '';
		if(!area || area == "") return this;
		
		var d = this.phrases.designer;

		if(area=="satellite"){

			if(this.choices.mirror && this.data.mirror[this.choices.mirror]){
				var m = this.data.mirror[this.choices.mirror];
				var cost = this.copyValue(m.cost);
				var mass = this.copyValue(m.mass);
				var time = this.copyValue(m.devtime);
				var buscost = this.copyValue(m.bus.cost);
				var busmass = this.copyValue(m.bus.mass);
				var bustime = this.copyValue(m.bus.devtime);
				var busdiam = this.copyValue(m.bus.diameter);
				
				// Applies to both mirror and bus
				if(this.choices.deployablemirror){
					var mu = this.data.deployablemirror.multiplier;
					if(mu.cost) cost.value *= mu.cost;
					if(mu.mass) mass.value *= mu.mass;
					if(mu.time) time.value *= mu.time;
					if(mu.bus.cost) buscost.value *= mu.bus.cost;
					if(mu.bus.mass) busmass.value *= mu.bus.mass;
					if(mu.bus.time) bustime.value *= mu.bus.time;
					if(mu.bus.diameter) busdiam.value *= mu.bus.diameter;
				}
				// If we have a UV mirror we apply the cost/mass/time multipliers
				if(this.choices.uvmirror){
					var mu = this.data.uvmirror.multiplier;
					if(mu.cost) cost.value *= mu.cost;
					if(mu.mass) mass.value *= mu.mass;
					if(mu.time) time.value *= mu.time;
				}
				html += this.buildRow(d.satellite.cost,cost);
				html += this.buildRow(d.satellite.mass,mass);
				html += this.buildRow(d.satellite.devtime,time);
				html += this.buildRow(d.satellite.bus.cost,buscost);
				html += this.buildRow(d.satellite.bus.mass,busmass);
				html += this.buildRow(d.satellite.bus.devtime,bustime);
				html += this.buildRow(d.satellite.bus.diameter,busdiam);
				html += this.buildRow(d.satellite.bus.slots,m.bus.instrumentslots);
			}

		}else if(area=="instruments"){

			value = this.getInstrument(value);
			html += this.buildRow(d.instruments.cost,value.cost)
			html += this.buildRow(d.instruments.mass,value.mass)
			html += this.buildRow(d.instruments.temperature,value.temp)
			html += this.buildRow(d.instruments.devtime,value.time)

		}else if(area=="cooling"){

			html += this.buildRow(d.cooling.temperature,this.choices.temperature);
			html += this.buildRow(d.cooling.cost,this.choices.cooling.cost);
			html += this.buildRow(d.cooling.mass,this.choices.cooling.mass);
			if(this.choices.cooling.time.value > 0) html += this.buildRow(d.cooling.devtime,this.choices.cooling.time);
			html += this.buildRow(d.cooling.life,this.choices.cooling.life);
			html += this.buildRow(d.cooling.risk,this.makeValue(this.choices.cooling.risk*100,'%'));

		}else if(area=="site"){

			if(typeof this.data.site[value].latitude==="number") html += this.buildRow(d.site.location,this.data.site[value].latitude.toFixed(2)+'&deg;, '+this.data.site[value].longitude.toFixed(2)+'&deg;');
			if(this.data.site[value].operator) html += this.buildRow(d.site.operator,this.phrases.operator[this.data.site[value].operator].label);
			html += this.buildRow(d.site.trajectories,d.site.options[value].trajectories);
			var sitenames = '';
			for(var o in this.data.site[value].orbits){
				if(this.data.site[value].orbits[o]) sitenames += ''+d.orbit.options[o].label+'<br />';
			}
			html += this.buildRow(d.site.orbits,sitenames);
			
			if(typeof this.data.site[value].risk==="number") html += this.buildRow(d.site.risk,(this.data.site[value].risk*100).toFixed(0)+'%');
			
		}else if(area=="orbit"){

			if(this.data.orbit[value].altitude) html += this.buildRow(d.orbit.altitude,this.data.orbit[value].altitude);
			if(this.data.orbit[value].period) html += this.buildRow(d.orbit.period,this.data.orbit[value].period);
			if(this.data.orbit[value].obsfrac) html += this.buildRow(d.orbit.obsfrac,{'value':this.data.orbit[value].obsfrac*100,'units':'%','dimension':'percent'});
			if(this.data.orbit[value].fuellife) html += this.buildRow(d.orbit.fuellife,this.data.orbit[value].fuellife);
			if(this.data.orbit[value].temperature) html += this.buildRow(d.orbit.temperature,this.data.orbit[value].temperature);
			if(this.data.orbit[value].groundcost) html += this.buildRow(d.orbit.groundcost,this.data.orbit[value].groundcost);
			if(this.data.orbit[value].risk) html += this.buildRow(d.orbit.risk,{'value':this.data.orbit[value].risk*100,'units':'%','dimension':'percent'});

		}

		html += '<div class="clearall"></div>';
		$('#designer_'+area+' .details').html(html).addClass('padded').show();
		return this;
	}
	
	SpaceTelescope.prototype.formatScenario = function(s){
		return ''+((typeof s.description==="string") ? s.description : "").replace(/%COST%/,this.formatValueSpan(s.budget))+'';
	}

	SpaceTelescope.prototype.updateOptions = function(){

		$('#options').html('<h3>'+this.phrases.ui.menu.options.label+'</h3><form id="optionform"><ul></ul>');

		// Loop over options
		for(var o in this.phrases.ui.options){
		
			html = '<li><label for="change'+o+'">'+this.phrases.ui.options[o]+'</label> <select id="change'+o+'" name="change'+o+'">';
			if(o=="currency"){
				for(var c in this.phrases.ui[o]){
					html += '<option value="'+c+'"'+(c==this.settings.currency ? ' selected="selected"' : '')+'>'+this.phrases.ui.currency[c].label+' '+this.phrases.ui.currency[c].symbol+'</option>';
				}
			}else{
				for(var c in this.phrases.ui.units){
					if(this.phrases.ui.units[c].dimension==o && this.phrases.ui.units[c].selectable) html += '<option value="'+c+'"'+(c==this.settings[o] ? ' selected="selected"' : '')+'>'+this.phrases.ui.units[c].label+'</option>';
				}			
			}
			html += '</select></li>'
			$('#options ul').append(html);

			// Add change events
			$('form#optionform #change'+o).on('change',{me:this,o:o},function(e){ e.data.me.settings[e.data.o] = $(this).val(); e.data.me.updateUnits(); });
		}

		// Add closer
		this.addCloser($('#options'),{me:this},function(e){ e.preventDefault(); e.data.me.closeModal($('#options')); });

		return this;
	}

	SpaceTelescope.prototype.updateUnits = function(){

		var els = $('.convertable');
		var el,val,v,u,d;
		
		for(var i = 0; i < els.length ; i++){
			el = $(els[i]);
			v = el.attr('data-value');
			u = el.attr('data-units');
			d = el.attr('data-dimension');
			if(v && u && d) el.html(this.formatValue({ 'value': v, 'units': u, 'dimension': d }));
		}

		this.updateDropdown('mirror_size');
		this.updateDropdown('cooling_temperature');
		return this;
	}
	
	// Update a value. If a time is provided and the original and final values share dimensions, it will animate the change
	// Inputs:
	//   key - the CSS key
	//   value - an object e.g. {'value': 10, 'units': 'kg', 'dimension': 'mass' }
	//   ms - the number of milliseconds to animate the number change over
	SpaceTelescope.prototype.updateValue = function(key,value,ms){
		var el;
		if(typeof key==="object") el = key;
		else if(typeof key==="string") el = $('.'+key+'.value');

		if(el.length > 0){
			if(typeof value==="object"){

				var orig = { 'value': parseFloat(el.attr('data-value'),10), 'units':el.attr('data-units'), 'dimension':el.attr('data-dimension') };

				if(ms && orig.dimension==value.dimension){
					var _obj = this;
					var steps = 20;
					if(!ms) ms = 400;
					var t = new Date();
					var i = 0;
					// We may need to convert the units
					if(value.units!=orig.units) value = this.convertValue(value,orig.dimension);
					// The animation frame
					function frame(){
						var diff = (new Date())-t;
						if(diff > ms){
							// We've finished so make sure the final values are set correctly
							el.html(_obj.formatValue(value)).attr({'data-value':value.value,'data-units':value.units,'data-dimension':value.dimension}).addClass('convertable');
						}else{
							el.html(_obj.formatValue({ 'value': (orig.value+(value.value-orig.value)*(diff/ms)), 'units':orig.units, 'dimension':orig.dimension }));
							requestAnimFrame(frame);
						}	
					}
					frame();
				}else{
					el.attr({'data-value':value.value,'data-units':value.units,'data-dimension':value.dimension}).html(this.formatValue(value)).addClass('convertable');
				}
			}else el.html(value);
		}
		return this;
	}

	SpaceTelescope.prototype.formatValueSpan = function(value,key){
		key = (key) ? " "+key : "";
		return (typeof value==="object" ? '<span class="value'+key+' convertable" data-value="'+value.value+'" data-units="'+value.units+'" data-dimension="'+value.dimension+'">'+this.formatValue(value)+'</span>' : '<span class="value'+key+'">'+value+'</span>');
	}
	
	SpaceTelescope.prototype.copyValue = function(v){
		if(typeof v==="object") return JSON.parse(JSON.stringify(v));
		return {};
	}
	
	SpaceTelescope.prototype.getValue = function(v){

		var el = $(v);
		if(el.length > 0){
			if(el.prop('tagName')=="SELECT") return el.find(":selected").attr('value');
			if(el.prop('tagName')=="INPUT") return el.val();
		}
		return "";
	}
	
	SpaceTelescope.prototype.getChoice = function(choice){
		if(choice=="mirror.cost"){
			v = (this.choices.mirror ? this.copyValue(this.data.mirror[this.choices.mirror].cost) : this.makeValue(0,'GBP'));
			v.value = -v.value;
			if(this.choices.deployablemirror && this.data.deployablemirror.multiplier.cost) v.value *= this.data.deployablemirror.multiplier.cost;
			if(this.choices.uvmirror && this.data.uvmirror.multiplier.cost) v.value *= this.data.uvmirror.multiplier.cost;
		}else if(choice=="mirror.mass"){
			v = (this.choices.mirror ? this.copyValue(this.data.mirror[this.choices.mirror].mass) : this.makeValue(0,'kg'));
			if(this.choices.deployablemirror && this.data.deployablemirror.multiplier.mass) v.value *= this.data.deployablemirror.multiplier.mass;
			if(this.choices.uvmirror && this.data.uvmirror.multiplier.mass) v.value *= this.data.uvmirror.multiplier.mass;
		}else if(choice=="mirror.time"){
			v = (this.choices.mirror ? this.copyValue(this.data.mirror[this.choices.mirror].devtime) : this.makeValue(0,'months'));
			if(this.choices.deployablemirror && this.data.deployablemirror.multiplier.time) v.value *= this.data.deployablemirror.multiplier.time;
			if(this.choices.uvmirror && this.data.uvmirror.multiplier.time) v.value *= this.data.uvmirror.multiplier.time;
		}else if(choice=="mirror.prob"){
			v = (this.choices.mirror ? this.data.mirror[this.choices.mirror].risk : 1);
			if(this.choices.deployablemirror && this.data.deployablemirror.risk) v *= this.data.deployablemirror.risk;
			if(this.choices.uvmirror && this.data.uvmirror.risk) v *= this.data.uvmirror.risk;
		}else if(choice=="mirror"){
			v = (this.choices.mirror) ? this.data.mirror[this.choices.mirror].diameter : this.makeValue(0,'m');
		}else if(choice=="cooling.cost"){
			v = (this.choices.cooling ? this.copyValue(this.choices.cooling.cost) : this.makeValue(0,'GBP'));
			v.value = -v.value;
		}else if(choice=="cooling.mass"){
			v = (this.choices.cooling && this.choices.cooling.mass ? this.copyValue(this.choices.cooling.mass) : this.makeValue(0,'kg'));
		}else if(choice=="cooling.passive.mass"){
			v = (this.choices.cooling && this.choices.cooling.passive ? this.copyValue(this.choices.cooling.passive) : this.makeValue(0,'kg'));
		}else if(choice=="cooling.active.mass"){
			v = (this.choices.cooling && this.choices.cooling.active ? this.copyValue(this.choices.cooling.active) : this.makeValue(0,'kg'));
		}else if(choice=="cooling.cryogenic.mass"){
			v = (this.choices.cooling && this.choices.cooling.cryogenic ? this.copyValue(this.choices.cooling.cryogenic) : this.makeValue(0,'kg'));
		}else if(choice=="cooling.time"){
			v = (this.choices.cooling ? this.copyValue(this.choices.cooling.time) : this.makeValue(0,'months'));
		}else if(choice=="cooling.life"){
			v = (this.choices.cooling && this.choices.cooling.life ? this.copyValue(this.choices.cooling.life) : this.makeValue(99,'years'));
		}else if(choice=="cooling.prob"){
			v = 1;
			if(this.choices.cooling && this.choices.cooling.risk) v = this.choices.cooling.risk;
		}else if(choice=="satellite.cost"){
			v = (this.choices.mirror ? this.copyValue(this.data.mirror[this.choices.mirror].bus.cost) : this.makeValue(0,'GBP'));
			if(this.choices.deployablemirror && this.data.deployablemirror.multiplier.bus.cost) v.value *= this.data.deployablemirror.multiplier.bus.cost;
			v.value = -v.value;
		}else if(choice=="satellite.mass"){
			v = (this.choices.mirror ? this.copyValue(this.data.mirror[this.choices.mirror].bus.mass) : this.makeValue(0,'kg'));
			if(this.choices.deployablemirror && this.data.deployablemirror.multiplier.bus.mass) v.value *= this.data.deployablemirror.multiplier.bus.mass;
		}else if(choice=="satellite.time"){
			v = (this.choices.mirror ? this.copyValue(this.data.mirror[this.choices.mirror].bus.devtime) : this.makeValue(0,'months'));
			if(this.choices.deployablemirror && this.data.deployablemirror.multiplier.bus.time) v.value *= this.data.deployablemirror.multiplier.bus.time;
		}else if(choice=="instruments.time"){
			v = (this.choices.instrument && this.choices.instrument.time) ? this.choices.instrument.time : this.makeValue(0,'months');
		}else if(choice=="instruments.cost"){
			v = (this.choices.instrument && this.choices.instrument.cost) ? this.choices.instrument.cost : this.makeValue(0,'GBP');
			v.value = -v.value;
		}else if(choice=="instruments.mass"){
			v = (this.choices.instrument && this.choices.instrument.mass) ? this.choices.instrument.mass : this.makeValue(0,'kg');
		}else if(choice=="instruments.prob"){
			v = (this.choices.instrument && this.choices.instrument.risk) ? this.choices.instrument.risk : 1;
		}else if(choice=="site"){
			v = (this.choices.site ? this.phrases.designer.site.options[this.choices.site].label : '');
		}else if(choice=="site.prob"){
			v = 0;
			if(this.choices.site){
				v = (this.data.site[this.choices.site].risk ? this.data.site[this.choices.site].risk : 1);
			}
		}else if(choice=="vehicle"){
			v = (this.choices.vehicle ? this.phrases.designer.vehicle.options[this.choices.vehicle].label : '');
		}else if(choice=="vehicle.cost"){
			v = (this.choices.vehicle ? this.copyValue(this.data.vehicle[this.choices.vehicle].cost) : this.makeValue(0,'GBP'));
			v.value = -v.value;		
		}else if(choice=="vehicle.prob"){
			v = 0;
			if(this.choices.vehicle){
				v = (this.data.vehicle[this.choices.vehicle].risk ? this.data.vehicle[this.choices.vehicle].risk : 1);
			}
		}else if(choice=="ground.cost"){
			var m = this.choices.mission ? this.copyValue(this.data.mission[this.choices.mission].life) : this.makeValue(0,'months');
			if(this.choices.orbit){
				v = this.copyValue(this.data.orbit[this.choices.orbit].groundcost);
				v.value *= -this.convertValue(m,'years').value;	
			}else{
				v = this.makeValue(0,'GBP');
			}
		}else if(choice=="temperature"){
			v = (this.choices.temperature) ? this.choices.temperature : this.makeValue(400,'K');
			if(this.choices.orbit) v = this.data.orbit[this.choices.orbit].temperature;
		}else if(choice=="launch.cost"){
			v = (this.choices.vehicle ? this.copyValue(this.data.vehicle[this.choices.vehicle].cost) : this.makeValue(0,'GBP'));
			v.value *= -(this.choices.orbit ? this.data.orbit[this.choices.orbit].multiplier.launchcost : 1);
		}else if(choice=="orbit"){
			v = (this.choices.orbit) ? this.phrases.designer.orbit.options[this.choices.orbit].label : '';
		}else if(choice=="orbit.prob"){
			v = 0;
			if(this.choices.orbit){
				v = (this.data.orbit[this.choices.orbit].risk) ? this.data.orbit[this.choices.orbit].risk : 1;
			}
		}else if(choice=="mission.time"){
			v = (this.choices.mission ? this.copyValue(this.data.mission[this.choices.mission].life) : this.makeValue(0,'months'));
		}else if(choice=="mission.prob"){
			v = (this.choices.mission && this.data.mission[this.choices.mission].risk ? this.data.mission[this.choices.mission].risk : 1);
		}else if(choice=="fuel.time"){
			v = (this.choices.orbit ? this.copyValue(this.data.orbit[this.choices.orbit].fuellife) : this.makeValue(0,'months'));
		}
		return v;
	}




	SpaceTelescope.prototype.processSummaryList = function(list,key,depth){
		depth++;
		var html = '<ul class="summary">';
		for(var i in list){

			if(list[i].value || list[i].list){
				html += '<li>';
				if(i && list[i].value) html += '<span class="label '+i+'">'+list[i].label+'</span>'+this.formatValueSpan(list[i].value,key+' '+i);
				if(list[i].list) html += this.processSummaryList(list[i].list,(depth==1 ? key : ''));
				html += '</li>';
			}
		}
		html += '</ul>';
		return html;
	}
	

	SpaceTelescope.prototype.updateSummaryList = function(){
		for(var key in this.table){
			var html = '';
			var base = key;
			if(base.indexOf('_') > 0) base = base.substr(0,base.indexOf('_'));
			var keys = base;
			if(base!=key) keys += ' '+key;
			var depth = 0;
			// Update summary bar items
			if(this.table[key].value) this.updateValue('baritem .'+key,this.table[key].value);
			var output = '<h3><img src="images/cleardot.gif" class="icon '+keys+'" /> <span class="label '+keys+'">'+this.table[key].label+'</span> '+(this.table[key].value ? this.formatValueSpan(this.table[key].value,keys) : '')+'</h3>';
			if(this.table[key].list) output += this.processSummaryList(this.table[key].list,base,depth);
			$('#summaryext_'+base).addClass('padded').html(output);
		}
		return this;
	}

	// Update the summary screen based on the user's choices
	SpaceTelescope.prototype.updateSummary = function(){

		this.log('updateSummary')

		var html = '';
		var s = this.phrases.ui.summary;

		var prob = {};
		var cost = {};
		var mass = {};
		var time = {};
		var prof = {};

		prob.mirror = this.getChoice('mirror.prob');
		prob.site = this.getChoice('site.prob');
		prob.vehicle = this.getChoice('vehicle.prob');
		prob.cooling = this.getChoice('cooling.prob');
		prob.orbit = this.getChoice('orbit.prob');
		prob.instruments = this.getChoice('instruments.prob');
		prob.mission = this.getChoice('mission.prob');
		prob.total = prob.orbit*prob.site*prob.vehicle*prob.mirror*prob.cooling*prob.instruments*prob.mission;

		// Warning about risk
		if(prob.total < 0.5 && prob.total > 0) this.warnings.push({ 'text': this.phrases.warnings.risky });
		if(prob.total == 0) this.errors.push({ 'text': this.phrases.errors.impossible });


		// Format costs
		cost.mirror = this.getChoice('mirror.cost');
		cost.satellite = this.getChoice('satellite.cost');
		cost.cooling = this.getChoice('cooling.cost');
		cost.instruments = this.getChoice('instruments.cost')
		cost.dev = this.sumValues(cost.mirror,cost.satellite,cost.cooling,cost.instruments);

		cost.vehicle = this.getChoice('vehicle.cost');
		cost.ground = this.getChoice('ground.cost');
		cost.launch = this.getChoice('launch.cost');
		cost.operations = this.sumValues(cost.launch,cost.ground);
		cost.total = this.sumValues(cost.dev,cost.operations);
		cost.free = this.sumValues(this.scenario.budget,cost.total);

		// Warning about funds
		if(cost.free.value < 0) this.errors.push({ 'text': this.phrases.errors.bankrupt });

		// Format times
		time.mirror = this.getChoice('mirror.time');
		time.satellite = this.getChoice('satellite.time');
		time.instruments = this.getChoice('instruments.time');
		time.cooling = this.getChoice('cooling.time');
		time.total = this.sumValues(time.mirror,time.satellite,time.cooling,time.instruments);
		time.mission = this.getChoice('mission.time');
		time.lifecooling = this.getChoice('cooling.life');
		time.fuel = this.getChoice('fuel.time');

		var v = this.minValue(time.mission,time.lifecooling,time.fuel);
		v.value *= (this.choices.orbit) ? this.data.orbit[this.choices.orbit].obsfrac : 0;
		time.observing = v;

		var fuel = this.convertValue(time.fuel,time.mission.units);
		if(time.mission.value > fuel.value) this.warnings.push({ 'text': this.phrases.warnings.fuellifetime.replace(/%LIFE%/,this.formatValue(fuel)).replace(/%DURATION%/,this.formatValue(time.mission)), 'link':'#designer_orbit' });
		var cool = this.convertValue(time.lifecooling,time.mission.units);
		if(time.mission.value > cool.value) this.warnings.push({ 'text': this.phrases.warnings.coolinglifetime.replace(/%LIFE%/,this.formatValue(cool)).replace(/%DURATION%/,this.formatValue(time.mission)), 'link':'#designer_orbit' });
		
		// Warning about mission time
		if(prob.total > 0 && time.mission.value == 0) this.warnings.push({ 'text': this.phrases.warnings.missionlife,'link':'#designer_orbit'});
	    
		// Format masses
		mass.mirror = this.getChoice('mirror.mass');
		mass.satellite = this.getChoice('satellite.mass');
		mass.cooling = this.getChoice('cooling.mass');
		mass.instruments = this.getChoice('instruments.mass');
		mass.total = this.sumValues(mass.mirror,mass.satellite,mass.cooling,mass.instruments);

		// Error about mass
		if(this.choices.orbit && this.choices.vehicle){
			var m = this.convertValue((this.data.orbit[this.choices.orbit].LEO ? this.data.vehicle[this.choices.vehicle].mass.LEO : this.data.vehicle[this.choices.vehicle].mass.GTO),mass.total.units);
			if(mass.total.value > m.value) this.errors.push({ 'text': this.phrases.errors.heavy });
			if(mass.total.value <= m.value && mass.total.value > 0.8*m.value) this.warnings.push({ 'text': this.phrases.warnings.heavy });
		}


		this.table.success.value = this.formatPercent(prob.total);
		this.table.success.list.success_orbit.value = this.formatPercent(prob.orbit);
		this.table.success.list.success_site.value = this.formatPercent(prob.site);
		this.table.success.list.success_vehicle.value = this.formatPercent(prob.vehicle);
		this.table.success.list.success_deploy.value = this.formatPercent(prob.mirror);
		this.table.success.list.success_cooling.value = this.formatPercent(prob.cooling);
		this.table.success.list.success_instruments.value = this.formatPercent(prob.instruments);
		this.table.success.list.success_mission.value = this.formatPercent(prob.mission);

		this.updateTable('cost_available','value',cost.free);
		this.updateTable('cost_initial','value',this.scenario.budget);
		this.updateTable('cost_dev_total','value',cost.dev);
		this.updateTable('cost_dev_satellite','value',cost.satellite);
		this.updateTable('cost_dev_mirror','value',cost.mirror);
		this.updateTable('cost_dev_cooling','value',cost.cooling);
		this.updateTable('cost_dev_instruments','value',cost.instruments);
		this.updateTable('cost_operations_total','value',cost.operations);
		this.updateTable('cost_operations_launch','value',cost.launch);
		this.updateTable('cost_operations_ground','value',cost.ground);
		this.updateTable('cost_total','value',cost.total);
		this.table.cost_available.list.cost_available.value = cost.free;

		this.updateTable('time_dev_total','value',time.total);
		this.table.time_dev_total.list.time_dev_total.value = time.total;
		this.updateTable('time_dev_satellite','value',time.satellite);
		this.updateTable('time_dev_mirror','value',time.mirror);
		this.updateTable('time_dev_cooling','value',time.cooling);
		this.updateTable('time_dev_instruments','value',time.instruments);
		this.updateTable('time_mission','value',time.mission);
		this.updateTable('time_cooling','value',time.lifecooling);
		this.updateTable('time_fuel','value',time.fuel);
		this.updateTable('time_observing','value',time.observing);
		this.table.mass_total.value = mass.total;
		this.table.mass_total.list.mass_satellite.value = mass.satellite;
		this.table.mass_total.list.mass_mirror.value = mass.mirror;
		this.table.mass_total.list.mass_cooling_total.value = mass.cooling;
		if(this.settings.mode=="advanced"){
			this.table.mass_total.list.mass_cooling_total.list.mass_cooling_passive.value = this.getChoice('cooling.passive.mass');
			this.table.mass_total.list.mass_cooling_total.list.mass_cooling_cryo.value = this.getChoice('cooling.cryogenic.mass');
			this.table.mass_total.list.mass_cooling_total.list.mass_cooling_active.value = this.getChoice('cooling.active.mass');
		}
		this.table.mass_total.list.mass_instruments.value = mass.instruments;
		
		// Check mission targets
		var av = 0;
		this.table.science_total.list = {};
		if(this.scenario && this.scenario.requires && typeof this.scenario.requires==="object"){ 
			var requires = this.scenario.requires;
			var v, ok, pc, w;
			// Build mission target list
			this.table.science_total.list = {};
			for(var r = 0; r < requires.length; r++){
				pc = 0;
				if(requires[r]["instruments"]){
					ok = false;
					//"instrument": "camera",
					//"wavelength": "farir"
					if(this.choices.instruments){
						for(var i = 0; i < requires[r]["instruments"].length ; i++){
							ok = false;
							for(var j = 0; j < this.choices.instruments.length ; j++){
								if((this.choices.instruments[j].type==requires[r]["instruments"][i].type || this.choices.instruments[j].type=="both") && this.choices.instruments[j].wavelength==requires[r]["instruments"][i].wavelength) ok = true;
							}
							if(ok) pc += 100;
						}
					}
					if(requires[r]["instruments"].length > 0) pc /= requires[r]["instruments"].length;
					if(pc!=100) this.errors.push({ 'text': requires[r].error });
				}
				if(requires[r]["mirror"]){
					w = this.copyValue(requires[r]["mirror"]);
					v = this.convertValue(this.getChoice('mirror'),w.units);
					if(v.value < w.value) this.errors.push({ 'text': requires[r].error });
					else pc = 100;
				}
				if(requires[r]["devtime"]){
					w = this.copyValue(requires[r]["devtime"]);
					v = this.convertValue(this.table.time_dev_total.value,w.units);
					if(v.value > w.value) this.errors.push({ 'text': requires[r].error.replace(/%DEVTIME%/,this.formatValue(v)) });
					else pc = 100;
				}
				if(requires[r]["vehicle"]){
					ok = false;
					if(typeof requires[r]["vehicle"]==="object"){
						for(var i = 0; i < requires[r]["vehicle"].length ; i++){
							if(this.choices.vehicle==requires[r]["vehicle"][i]) ok = true;
						}
					}else{
						if(this.choices.vehicle==requires[r]["vehicle"]) ok = true;
					}
					if(!ok) this.errors.push({ 'text': requires[r].error });
					else pc = 100;
				}
				if(requires[r]["site"]){
					w = (this.choices.vehicle) ? this.phrases.designer.vehicle.options[this.choices.vehicle].label : '';
					if(this.choices.vehicle == requires[r]["vehicle"]) this.errors.push({ 'text': requires[r].error });
					else pc = 100;
				}
				if(requires[r]["observingtime"]){
					w = this.copyValue(requires[r]["observingtime"]);
					v = this.convertValue(this.table.time_dev_total.list.time_observing.value,w.units)
					if(v.value < w.value) this.errors.push({ 'text': requires[r].error.replace(/%OBSERVINGTIME%/,this.formatValue(v)) });
					else pc = 100;
				}
				if(!requires[r]["label"]) requires[r]["label"] = "UNKNOWN";
				this.table.science_total.list['target'+r] = { 'label': (v ? requires[r].label.replace(/%VALUE%/,this.formatValue(w)) : requires[r].label), 'value': this.makeValue(pc,'%') };
				av += pc;
			}
			if(requires.length > 0) av /= requires.length;
			else av = 100;
		}
		this.table.science_total.value = this.makeValue(av,'%');


		this.table.profile_total.list.profile_site.value = this.getChoice('site');
		this.table.profile_total.list.profile_vehicle.value = this.getChoice('vehicle');
		this.table.profile_total.list.profile_instruments.value = (this.choices.instruments) ? this.choices.instruments.length : 0;
		this.table.profile_total.list.profile_mirror.value = this.getChoice('mirror');
		this.table.profile_total.list.profile_temperature.value = this.getChoice('temperature');
		this.table.profile_total.list.profile_orbit.value = this.getChoice('orbit');
		var d = new Date();
		var t = this.convertValue(time.total,'months');
		d.setUTCMonth(d.getUTCMonth()+t.value);
		this.launchdate = d.toDateString();
		this.table.profile_total.list.profile_launch.value = d.toDateString();
		t = this.convertValue(this.minValue(time.mission,time.fuel,time.lifecooling),'months');
		d.setUTCMonth(d.getUTCMonth()+t.value);
		this.table.profile_total.list.profile_end.value = d.toDateString();

		if(this.choices.orbit && this.choices.site && this.choices.vehicle && this.errors.length==0) this.enableLaunch();
		else this.disableLaunch();

		this.updateSummaryList();

		return this;
	}

	SpaceTelescope.prototype.enableLaunch = function(){
		this.launchable = true;
		$('.togglelaunch').show();
		return this;
	}
	
	SpaceTelescope.prototype.disableLaunch = function(){
		this.launchable = false;
		$('.togglelaunch').hide();
		return this;
	}
	SpaceTelescope.prototype.test = function(){

		$('#introduction .fancybtn').trigger('click');
		this.chooseScenario(this.scenarios.length-1)
		
		$('#mirror_size').val('1.0m');
		$('#wavelengths').val('submm');
		$('#instruments').val((this.settings.mode=="advanced" ? 'both' : 'camera'));
		$('#instrument_name').val('SPIRE');
		$('.add_instrument').trigger('click');
		$('#wavelengths').val('farir');
		$('#instruments').val((this.settings.mode=="advanced" ? 'spectrometer' : 'camera'));
		$('#instrument_name').val('HIFI');
		$('.add_instrument').trigger('click');
		$('#wavelengths').val('farir');
		$('#instruments').val((this.settings.mode=="advanced" ? 'both' : 'camera'));
		$('#instrument_name').val('PACS');
		$('.add_instrument').trigger('click');
		$('input[name=hascooling]').trigger('click');
		$('input[name=cooling_active]').trigger('click');
		$('#cooling_cryogenic').val('2yr');
		$('#cooling_temperature').val('0.3K');
		$('#vehicle_rocket_ARI5').trigger('click');
		$('#site').val('CSG');
		$('#mission_duration').val('7')
		$('#mission_orbit').val('ES2').trigger('change');
		
		return this;
	}

	// Function to launch
	SpaceTelescope.prototype.goForLaunch = function(){

		this.log('goForLaunch')

		if(!this.launchable){
			this.showView('designer');
			return this;
		}
		
		if(this.stage=="launch"){
			$('.togglelaunch').hide();
			$('body').addClass('showlaunch');
			$('#launch').show();
	
			var orbit = this.phrases.designer.orbit.options[this.choices.orbit].label;
			var vehicle = this.phrases.designer.vehicle.options[this.choices.vehicle].label;
			var site = this.phrases.designer.site.options[this.choices.site].label;
			var devtime = this.formatValue(this.table.time_dev_total.list.time_dev_total.value);

			// Build launch progress
			$('#launch').html('<h2>'+this.phrases.launch.title+'</h2><p>'+this.phrases.launch.intro.replace(/%DEVTIME%/,devtime).replace(/%VEHICLE%/,vehicle).replace(/%SITE%/,site).replace(/%ORBIT%/,orbit).replace(/%LAUNCHDATE%/,this.launchdate)+'</p><div id="launchanimation">'+('<div id="launchpadbg"><img src="images/launchpad_'+this.choices.site+'.png" /></div><div id="launchpadfg"><img src="images/launchpad_'+this.choices.site+'_fg.png" /></div><div id="launchrocket"><img src="'+this.data.vehicle[this.choices.vehicle].img+'" /></div>')+'<div id="countdown" class="padded">Countdown</div></div><ul id="launchtimeline"></ul><div id="launchnav" class="toppadded"></div>');
	
			this.launchstep = 0;
			if(this.launchstep==0) this.countdown(10);
		}
	}

	SpaceTelescope.prototype.countdown = function(i){

		this.launchstep = 1;

		var _obj = this;
		if(i > 0){
			$('#countdown').html('<div class="tick">'+this.phrases.launch.countdown[i.toFixed(0)]+'</div>');
			i--;
			if(!this.outtatime) clearTimeout(this.outtatime);
			this.outtatime = setTimeout(function(){ _obj.countdown(i); },1000);
		}else{
			$('#countdown').html(''+this.phrases.launch.countdown["liftoff"])
			this.ok = true;
			this.okcool = true;
			// Set temperature from orbit
			this.temperature = this.copyValue(this.data.orbit[this.choices.orbit].temperature);
			this.launch();
		}
	}

	// The function to process the launch steps
	SpaceTelescope.prototype.launch = function(){

		// Move us on a step
		this.launchstep++;
		
		// Build launch progress
		$('#launchnav').html('<a href="#" class="button fancybtn">'+this.phrases.launch.next+'</a>');

		// Get the probabilities for everything
		var prob = {
			'mirror': this.getChoice('mirror.prob'),
			'site': this.getChoice('site.prob'),
			'vehicle': this.getChoice('vehicle.prob'),
			'cooling': this.getChoice('cooling.prob'),
			'orbit': this.getChoice('orbit.prob'),
			'mission': this.getChoice('mission.prob')
		}

		var status = this.phrases.launch.status;
		var ok = true;	// We are fine to continue

		if(this.ok){
			if(this.launchstep==2){
				this.ok = this.roll(prob.site*prob.vehicle);
				$('#launchtimeline').append('<li>'+this.buildRow(this.phrases.launch.launch.label,(this.ok ? this.phrases.launch.launch.success : this.phrases.launch.launch.fail),'launch_launch')+'</li>');
				if(this.ok){
					// Rocket launched
					$('#launchanimation').addClass(this.choices.vehicle).addClass('launched');
					this.exhaust = new Exhaust();
				}
			}else this.exhaust.stop();
			if(this.launchstep==3){
				this.ok = this.roll(prob.orbit);
				$('#launchtimeline').append('<li>'+this.buildRow(this.phrases.launch.orbit.label,(this.ok ? this.phrases.launch.orbit.success : this.phrases.launch.orbit.fail).replace(/%ORBIT%/,this.getChoice('orbit')),'launch_orbit')+'</li>');
			}
			if(this.launchstep==4){	
				this.ok = this.roll(prob.mirror);
				$('#launchtimeline').append('<li>'+this.buildRow(this.phrases.launch.deploy.label,(this.ok ? this.phrases.launch.deploy.success : this.phrases.launch.deploy.fail),'launch_mirror')+'</li>');
			}
			if(this.launchstep==5){
				var okcool = true;
				var okpassive = true;
				// Has the user requested cooling?
				if(this.choices.hascooling){
					// Do we have temperature-based cooling (normal mode)
					if(this.choices.cool.temperature){
						var t = this.data.cooling.temperature[$('#cooling_temperature').val()];
						if(t.temperature) this.temperature = this.copyValue(t.temperature);
						if(!t.risk) t.risk = 1;
						okcool = this.roll(t.risk);
						$('#launchtimeline').append('<li>'+this.buildRow(this.phrases.launch.cooling.label.label,(okcool ? this.phrases.launch.cooling.label.success : this.phrases.launch.cooling.label.fail),'launch_temperature')+'</li>');
					}
					
					// Do we have passive cooling
					if(this.data.cooling.passive){
						$('#launchtimeline').append('<li>'+this.buildRow(this.phrases.launch.cooling.label.label,'','launch_cooling')+'</li>');
						p = this.choices.cool.passive;
						if(p=="yes"){
							okcool = this.roll(this.data.cooling.passive[p].risk);
							okpassive = okcool;
							if(okcool) this.temperature.value *= this.data.cooling.passive[p].multiplier.temperature;
							$('#launchtimeline').append('<li class="indent">'+this.buildRow(this.phrases.launch.cooling.passive.label,(okcool ? this.phrases.launch.cooling.passive.success : this.phrases.launch.cooling.passive.fail),'launch_passive')+'</li>');

							// Do we have active cooling (requires passive cooling)?
							if(this.data.cooling.active && okpassive){
								p = this.choices.cool.active;
								if(p=="yes"){
									okcool = this.roll(this.data.cooling.active[p].risk);
									if(okcool) this.temperature.value *= this.data.cooling.active[p].multiplier.temperature;
									$('#launchtimeline').append('<li class="indent">'+this.buildRow(this.phrases.launch.cooling.active.label,(okcool ? this.phrases.launch.cooling.active.success : this.phrases.launch.cooling.active.fail),'launch_active')+'</li>');
								}
							}
							// Do we have cryogenic cooling (requires passive cooling)?
							if(this.data.cooling.cryogenic && okpassive){
								p = this.choices.cool.cryogenic;
								if(p && p!="none"){
									okcool = this.roll(this.data.cooling.cryogenic[p].risk);
									if(okcool) this.temperature.value *= this.data.cooling.cryogenic[p].multiplier.temperature;
									$('#launchtimeline').append('<li class="indent">'+this.buildRow(this.phrases.launch.cooling.cryogenic.label,(okcool ? this.phrases.launch.cooling.cryogenic.success : this.phrases.launch.cooling.cryogenic.fail),'launch_cryogenic')+'</li>');
								}
							}
						}
					}
				}
				$('#launchtimeline').append('<li class="indent">'+this.buildRow(this.phrases.launch.cooling.achieved.label,(okcool ? this.phrases.launch.cooling.achieved.success : this.phrases.launch.cooling.achieved.fail).replace(/\%TEMPERATURE%/,this.formatValue(this.temperature)))+'</li>');
			}
			if(this.launchstep==6){
				var percent = 0;
				if(this.choices.instruments){
					$('#launchtimeline').append('<li>'+this.buildRow(this.phrases.launch.instruments.label,'')+'</li>');
					for(var i = 0; i < this.choices.instruments.length; i++){
						var therm = this.convertValue(this.data.wavelengths[this.choices.instruments[i].wavelength].temperature,this.temperature.units);
						ok = (therm.value >= this.temperature.value) ? true : false;
						this.choices.instruments[i].ok = ok;
						$('#launchtimeline').append('<li class="indent">'+this.buildRow(this.choices.instruments[i].name+' ('+this.phrases.wavelengths[this.choices.instruments[i].wavelength].label+' '+this.phrases.designer.instruments.options.instrument[this.choices.instruments[i].type].label+')',(ok ? this.phrases.launch.instruments.success : this.phrases.launch.instruments.fail),'launch_instrument')+'</li>');
					}
				}
			}
			if(this.launchstep==7){
				var percent = 0;
				if(this.choices.instruments){
					$('#launchtimeline').append('<li>'+this.buildRow(this.phrases.launch.science.label,'')+'</li>');

					for(var i = 0; i < this.choices.instruments.length; i++){
						if(this.choices.instruments[i].ok){
							var t = this.copyValue(this.data.instrument.options[this.choices.instruments[i].type]);
							if(!t.risk) t.risk = 1;
							t.risk *= prob.mission;
							ok = this.roll(t.risk);
							this.log(i,t.risk,ok)
							var pc = 100;
							if(!ok) pc = Math.random()*100;
							percent += pc;
							tmp = (ok ? this.phrases.launch.science.success : this.phrases.launch.science.fail).replace(/%PERCENT%/,this.formatValue(this.makeValue(pc,'%')));
							$('#launchtimeline').append('<li class="indent">'+this.buildRow(this.choices.instruments[i].name+' ('+this.phrases.wavelengths[this.choices.instruments[i].wavelength].label+' '+this.phrases.designer.instruments.options.instrument[this.choices.instruments[i].type].label+')',tmp,'launch_science')+'</li>');
						}
					}
					if(this.choices.instruments.length > 0) percent /= this.choices.instruments.length;
				}
	
				tmp = (this.ok ? this.phrases.launch.overall.success : this.phrases.launch.overall.fail).replace(/\%PERCENT%/,this.formatValue(this.makeValue(percent,'%')));
				$('#launchtimeline').append('<li>'+this.buildRow(this.phrases.launch.overall.label,tmp,'finalresult')+'</li>');
				$('.printable').remove();
				$('#launchtimeline').after('<div class="printable toppadded"><a href="#" class="button fancybtn">'+this.phrases.designer.proposal.reprint+'</a></div>');
				$('#launchnav').html("");
				this.launchstep = 0;
			}
		}
		if(!this.ok){
			
			// It failed so remove next button
			$('#launchnav a.button').remove();

			// Allow a one-time only restart
			
			if(!this.relaunched){
				var devtime = this.table.time_dev_total.list.time_dev_total.value;
				var relaunchtime = this.copyValue(devtime);
				relaunchtime.value *= 0.5;
				var cost = this.sumValues(this.getChoice('mirror.cost'),this.getChoice('satellite.cost'),this.getChoice('cooling.cost'),this.getChoice('instruments.cost'));
				cost.value *= 0.5;
				cost = this.sumValues(cost,this.getChoice('vehicle.cost'));
				cost.value *= -1;

				$('#launchtimeline').after('<div class="relaunch toppadded"><p>'+this.phrases.launch.relaunch.text.replace(/\%DEVTIME\%/,this.formatValue(devtime)).replace(/%RELAUNCHTIME%/,this.formatValue(relaunchtime)).replace(/%RELAUNCHCOST%/,this.formatValueSpan(cost))+'</p><a href="#" class="button fancybtn">'+this.phrases.launch.relaunch.label+'</a></div>');
			}else{
				$('.relaunch').remove();
			}
		}
		
		return this;
	}

	SpaceTelescope.prototype.relaunch = function(){
		this.relaunched = true;
		this.goForLaunch();
	}


	SpaceTelescope.prototype.roll = function(prob){
		if(!prob) prob = 1;
		return (Math.random() > prob) ? false : true;
	}

	SpaceTelescope.prototype.setKey = function(t,key,typ,value){
		for(i in t){
			if(i==key){
				t[i][typ] = value;
				return t;
			}else{
				if(t[i].list){
					t[i].list = this.setKey(t[i].list,key,typ,value);
				}
			}
		}
		return t;
	}

	SpaceTelescope.prototype.updateTable = function(key,typ,value){
		this.table = this.setKey(this.table,key,typ,value);
		return this;
	}
	
	// Convert an input value/unit/dimension object into another unit
	// Inputs:
	//   v - the { "value": 1, "units": "m", "dimension": "length" } object
	//   to - the new unit (must be one of the acceptable units for the dimension
	// Output:
	//   An { "value": 1, "units": "m", "dimension": "length" } object
	SpaceTelescope.prototype.convertValue = function(v,to){

		// If the input isn't the sort of thing we expect we just return it
		if(typeof v != "object") return v;

		if(typeof v.value==="string" && v.value != "inf") v.value = parseFloat(v.value,10);

		v = this.copyValue(v);
		

		if(v.dimension == "length"){
			if(v.dimension == this.phrases.ui.units[to].dimension){
				if(v.units != to){
					// Step 1: convert to SI
					if(v.units == "ft") v.value /= 3.281;
					if(v.units == "km") v.value *= 1000;
					if(v.units == "mile") v.value *= 1609;
					if(v.units == "cubit") v.value *= 0.4572;
					if(v.units == "bluewhale") v.value *= 30;
					if(v.units == "yard") v.value *= 0.9144;
					// Step 2: convert to new unit
					if(to == "ft") v.value *= 3.281;
					if(to == "km") v.value *= 0.001;
					if(to == "mile") v.value /= 1609;
					if(to == "cubit") v.value /= 0.4572;
					if(to == "bluewhale") v.value /= 30;
					if(to == "yard") v.value /= 0.9144;
					v.units = to;
				}
				if(v.units=="m" && v.value > 1000){
					v.value /= 1000;
					v.units = "km";
				}
				if(v.units=="ft" && v.value > 5280){
					v.value /= 5280;
					v.units = "mile"
				}
				if(v.units=="yard" && v.value > 5280){
					v.value /= 5280;
					v.units = "league";
				}
			}
		}else if(v.dimension == "mass"){
			if(v.dimension == this.phrases.ui.units[to].dimension){
				if(v.units != to){
					// Step 1: convert to SI
					if(v.units == "lb") v.value /= 2.205;
					if(v.units == "t") v.value *= 1000;
					if(v.units == "elephant") v.value *= 5400;
					// Step 2: convert to new unit
					if(to == "lb") v.value *= 2.205;
					if(to == "t") v.value /= 1000;
					if(to == "elephant") v.value /= 5400;
					v.units = to;
				}
			}
		}else if(v.dimension == "temperature"){
			if(v.dimension == this.phrases.ui.units[to].dimension){
				if(v.units != to){
					// Step 1: convert to SI
					if(v.units == "C") v.value += 273;
					else if(v.units == "F") v.value = (5/9)*(v.value - 32) + 273;
					// Step 2: convert to new unit
					if(to == "C") v.value -= 273;
					else if(to == "F") v.value = (9/5)*(v.value - 273) + 32;
					v.units = to;
				}
			}
		}else if(v.dimension == "time"){
			if(to == "years" || to == "months" || to == "days" || to == "hours"){
				if(v.units != to){
					// Step 1: convert to SI
					if(v.units == "months") v.value /= 12;
					else if(v.units == "days") v.value /= 365.25;
					else if(v.units == "hours") v.value /= 365.25*24;
					else if(v.units == "minutes") v.value /= 365.25*24*60;
					// Step 2: convert to new unit
					if(to == "months") v.value *= 12;
					else if(to == "days") v.value *= 365.25;
					else if(to == "hours") v.value *= 365.25*24;
					else if(to == "minutes") v.value *= 365.25*24*60;
					v.units = to;
				}
			}
		}else if(v.dimension == "angle"){
			if(to == "degrees" || to == "arcmin" || to == "arcsec"){
				if(v.units != to){
					// Step 1: convert to SI
					if(v.units == "arcmin") v.value /= 60;
					else if(v.units == "arcsec") v.value /= 3600;
					// Step 2: convert to new unit
					if(to == "arcmin") v.value *= 60;
					else if(to == "arcsec") v.value *= 3600;
					v.units = to;
				}
			}
		}else if(v.dimension == "currency"){
			if(this.data.currency[to]){
				if(v.units != to){
					if(v.value != "inf"){
						// Step 1: convert to GBP
						if(this.data.currency[v.units].conv) v.value /= this.data.currency[v.units].conv;
						// Step 2: convert to new unit
						if(this.data.currency[to].conv) v.value *= this.data.currency[to].conv;
					}
					v.units = to;
				}
			}
		}

		return v;
	}


	// Sum an array of input values.
	// Input:
	//   An array of the form {'value':100,'units':'GBP','dimension':'currency'},{'value':100,'units':'GBP','dimension':'currency'}
	// Output:
	//   A value object with the same dimension and units as the first input value
	// Notes:
	//   Only values with the same dimension will be summed
	//   Input units can differ - this will take care of unit conversions
	SpaceTelescope.prototype.sumValues = function(){
		var args = Array.prototype.slice.call(arguments, 0);
		var a,output,i;
		if(args.length > 0){
			output = this.convertValue(args[0],args[0].units);
			for(i = 1 ; i < args.length ; i++){
				if(typeof args[i]==="object" && args[i].dimension && args[i].dimension===output.dimension){
					a = this.convertValue(args[i],args[0].units);
					output.value += a.value;
				}
			}
			return output;
		}
		return {};
	}

	// Return the negative of the input value
	// Input:
	//   In the form {'value':100,'units':'GBP','dimension':'currency'}
	// Output:
	//   The negative of the input
	// Notes:
	//   Only values with the same dimension will be summed
	//   Input units can differ - this will take care of unit conversions
	SpaceTelescope.prototype.negativeValue = function(){
		var args = Array.prototype.slice.call(arguments, 0);
		var a,output,i;
		if(args.length > 0){
			output = this.copyValue(args[0]);
			output.value *= -1;
			return output;
		}
		return {};
	}

	// Return the minimum value in an array of input values	
	SpaceTelescope.prototype.minValue = function(){
		var args = Array.prototype.slice.call(arguments, 0);
		var a,i,min;
		if(args.length > 0){
			min = this.convertValue(args[0],args[0].units);
			for(i = 1 ; i < args.length ; i++){
				if(typeof args[i]==="object" && args[i].dimension && args[i].dimension===args[0].dimension){
					a = this.convertValue(args[i],args[0].units);
					if(a.value < min.value) min = a;
				}
			}
			return min;
		}
		return {};
	}
	
		
	

	function getPrecision(v){
		if(v < 1e-9) return 1;
		if(typeof v==="number" && v < 1) return Math.ceil(G.log10(1/v))+1;
		else return 1;
		return 1;
	
	}
		
	// Format a value differently depending on the dimension
	// Inputs:
	//  v - the value as an object e.g. { "value": 1, "units": "m", "dimension": "length" }
	//  p - the number of decimal places to show in the output (if not provided the function
	//      makes an intelligent guess).
	SpaceTelescope.prototype.formatValue = function(v,p){

		if(typeof v==="string" || typeof v==="number") return v;
		if(!(typeof v==="object" && v.dimension)) return "";

		// Make a copy of the original so that we don't overwrite it
		v = this.copyValue(v);

		// Convert precision to a number if it is a string
		if(typeof p==="string") p = parseInt(p,10);

		if(v.dimension=="length"){
			
			v = this.convertValue(v,(this.settings.length) ? this.settings.length : "m")
			if(typeof p!=="number") p = (v.units=="km" ? 0 : getPrecision(v.value));
			var unit = (this.phrases.ui.units[v.units]) ? this.phrases.ui.units[v.units].unit : "";
			if(v.value > 1e15) return powerOfTen(v.value,unit);
			return ''+addCommas((v.value).toFixed(p)).replace(/\.0+$/,'').replace(/(\.0?[1-9]+)0+$/,"$1")+''+unit;	
			
		}else if(v.dimension=="mass"){

			v = this.convertValue(v,(this.settings.mass) ? this.settings.mass : "kg")
			var unit = (this.phrases.ui.units[v.units]) ? this.phrases.ui.units[v.units].unit : "";
			if(typeof p!=="number") p = (v.value >= 1000) ? 0 : getPrecision(v.value);
			if(v.value > 1e15) return powerOfTen(v.value,unit);
			else return ''+addCommas((v.value).toFixed(p)).replace(/\.0+$/,'').replace(/(\.[1-9]+)0+$/,"$1")+''+unit;
		
		}else if(v.dimension=="currency"){
			v = this.convertValue(v,(this.settings.currency) ? this.settings.currency : "GBP")
			if(typeof p!=="number") p = 0;
	
			var append = (this.phrases.ui.million.compact) ? this.phrases.ui.million.compact : "";
			var s = (this.phrases.ui.currency[v.units] && this.phrases.ui.currency[v.units].symbol) ? this.phrases.ui.currency[v.units].symbol : (this.phrases.ui.currency["GBP"].symbol ? this.phrases.ui.currency["GBP"].symbol : "");
	
			if(v.value == "inf" || v.value >= 1e15) return '&infin;';
	
			// Correct for sign of currency (we can have negative values)
			var sign = (v.value < 0) ? '-' : '';
			v.value = Math.abs(v.value);
	
			// Change the "million" to "billion" if the number if too big
			if(v.value >= 1000){
				v.value /= 1000;
				append = (this.phrases.ui.billion.compact) ? this.phrases.ui.billion.compact : "";
			}
			if(p == 0){
				if(v.value < 100) p = 1;
				if(v.value < 10) p = 2;
			}
			var val = (v.value).toFixed(p).replace(/\.0+$/,'').replace(/(\.[1-9]+)0+$/,"$1").replace(/^ /,"&thinsp;");
			return sign+s+val+append;

		}else if(v.dimension=="temperature"){

			v = this.convertValue(v,(this.settings.temperature) ? this.settings.temperature : "K")
			if(typeof p==="string") p = parseInt(p,10);
			if(typeof p!=="number") p = (v.value > 1000) ? 0 : getPrecision(v.value);
			var unit = (this.phrases.ui.units[v.units]) ? this.phrases.ui.units[v.units].unit : "";
			if(typeof v.value==="string") v.value = parseInt(v.value,10)
			return ''+addCommas((v.value).toFixed(p).replace(/\.0+$/,'').replace(/(\.[1-9])0+$/,"$1"))+''+unit;

		}else if(v.dimension=="time"){

			if(v.units=="years" && v.value < 5) v = this.convertValue(v,"months");
			if(typeof p!=="number") p = (v.value >= 6) ? 0 : getPrecision(v.value);
			var unit = (this.phrases.ui.units[v.units]) ? this.phrases.ui.units[v.units].unit : "";
			if(typeof v.value==="string") v.value = parseInt(v.value,10)
			return ''+addCommas((v.value).toFixed(p).replace(/\.0+$/,'').replace(/(\.[1-9])0+$/,"$1"))+''+unit;

		}else if(v.dimension=="percent"){

			v = v.value;
			if(typeof v!=="number") v = parseInt(v,10)
			if(typeof v!=="number") return "0"+unit;
			if(typeof p!=="number") p = 1;
			var unit = (this.phrases.ui.units[v.units]) ? this.phrases.ui.units[v.units].unit : "%";
			return ''+addCommas(v.toFixed(p)).replace(/\.0+$/,'').replace(/(\.[1-9]+)0+$/,"$1")+unit;

		}else if(v.dimension=="angle"){

			if(v.units=="degrees" && v.value < 1) v = this.convertValue(v,"arcmin");
			if(v.units=="arcmin" && v.value < 1) v = this.convertValue(v,"arcsec");
			if(typeof p!=="number") p = (v.value >= 10) ? 0 : getPrecision(v.value);
			var unit = (this.phrases.ui.units[v.units]) ? this.phrases.ui.units[v.units].unit : "";
			if(typeof v.value==="string") v.value = parseInt(v.value,10);
			return ''+addCommas((v.value).toFixed(p).replace(/\.0+$/,'').replace(/(\.[1-9])0+$/,"$1"))+''+unit;

		}else return v.value;
	}

	SpaceTelescope.prototype.makeValue = function(v,u,d){
		if(!d){
			if(this.phrases.ui.units[u]) d = this.phrases.ui.units[u].dimension;
			else{
				if(this.phrases.ui.currency[u]) d = "currency";
				else d = "unknown";
			}
		}
		return { 'value': v, 'units': u, 'dimension': d };
	}

	// Inputs:
	//  v - e.g. 0.99 (99%)
	//  p - the number of decimal places to show in the output
	SpaceTelescope.prototype.formatPercent = function(v,p){
		if(typeof v!=="number") v = 0;
		if(typeof p!=="number") p = 1;
		return ''+addCommas((v*100).toFixed(p)).replace(/\.0+$/,'').replace(/(\.[1-9]+)0+$/,"$1")+'%';
	}

	// Display really large numbers as powers of ten
	function powerOfTen(v,u){
		var p = Math.floor(G.log10(v));
		var a = Math.round(v/Math.pow(10,p))
		return ''+a+'&times;10<sup>'+p+'</sup>'+u;
	}
	
	SpaceTelescope.prototype.toggleFullScreen = function(){
		// Get the container
		this.elem = document.getElementById("application");

		if(fullScreenApi.isFullScreen()){
			fullScreenApi.cancelFullScreen(this.elem);
			this.fullscreen = false;
			$('#application').removeClass('fullscreen');
		}else{
			fullScreenApi.requestFullScreen(this.elem);
			this.fullscreen = true;
			$('#application').addClass('fullscreen');
		}

		return this;
	}

	// Get the choices that the user has made
	SpaceTelescope.prototype.parseChoices = function(view,e){

		view = (view && view.indexOf('designer_')==0) ? view.substr(9) : "";

		this.log('parseChoices',view)

		var l,m,d,u,c,t,v,s,p;
		var cost,mass,temp,time,risk;
		this.errors = [];
		this.warnings = [];
		
		// Get mission
		l = $('#mission_duration').val();
		this.choices.mission = (l && this.data.mission[l]) ? l : "";

		// Get satellite
		m = $('#mirror_size').val();

		this.choices.mirror = (m && this.data.mirror[m]) ? m : "";
		d = $('input[name=toggledeployable]:checked').val();
		this.choices.deployablemirror = (d && d=="yes") ? true : false;

		u = $('input[name=toggleuv]:checked').val();
		this.choices.uvmirror = (u && u=="yes") ? true : false;

		// Get vehicle
		v = $('#designer_vehicle input[name=vehicle_rocket]:checked').val();
		this.choices.vehicle = (v && this.data.vehicle[v]) ? v : "";

		// Get site
		s = $('#site').val();
		var ok = false;
		this.choices.site = (s && this.data.site[s]) ? s : "";

		// Get orbit
		var o = $('#mission_orbit').val();
		if(o && this.data.orbit[o]) this.choices.orbit = o;
		else this.choices.orbit = "";

		// Get cooling
		c = $('input[name=hascooling]:checked').val();
		this.choices.hascooling = (c && c=="yes") ? true : false;
		this.choices.cool = {};
		t = $('#cooling_temperature').val();
		this.choices.cool.temperature = (t) ? t : "";
		this.choices.cool.passive = this.getValue('input[name=cooling_passive]:checked');
		this.choices.cool.active = this.getValue('input[name=cooling_active]:checked');
		this.choices.cool.cryogenic = $('#cooling_cryogenic').val();
		// Set a maximum temperature
		this.choices.temperature = this.makeValue(400,'K');

		// Process instruments
		this.choices.instrument = {
			"cost": this.makeValue(0,'GBP'),
			"mass": this.makeValue(0,'kg'),
			"temp": this.makeValue(400,'K'),
			"time": this.makeValue(0,'months'),
			"risk": 1
		}
		if(this.choices.instruments){
			var uv = false;
			for(var i = 0; i < this.choices.instruments.length; i++){
				var t = this.copyValue(this.data.instrument.options[this.choices.instruments[i].type]);
				if(!t.multiplier) t.multiplier = { };
				if(!t.multiplier.cost) t.multiplier.cost = 1;
				if(!t.multiplier.mass) t.multiplier.mass = 1;

				var w = this.copyValue(this.data.wavelengths[this.choices.instruments[i].wavelength]);
				if(w.cost) w.cost.value *= t.multiplier.cost;
				this.choices.instrument.cost = this.sumValues(this.choices.instrument.cost,w.cost);
				if(w.mass) this.choices.instrument.mass = this.sumValues(this.choices.instrument.mass,w.mass);
				this.choices.instrument.mass.value *= t.multiplier.mass;
				this.choices.instrument.temp = this.minValue(this.choices.instrument.temp,w.temperature);
				if(t.devtime) this.choices.instrument.time = this.sumValues(this.choices.instrument.time,t.devtime);
				if(t.risk) this.choices.instrument.risk *= t.risk;
				if(this.choices.instruments[i].wavelength=="uv") uv = true;
			}

			var slots = (this.choices.mirror) ? this.data.mirror[this.choices.mirror].bus.instrumentslots : 0;
			if(this.choices.instruments.length > slots) this.errors.push({ 'text': this.phrases.errors.slots, 'link': '#designer_instruments' });
			if(!this.choices.uvmirror && uv)  this.errors.push({ 'text': this.phrases.errors.uv, 'link': '#designer_satellite' });

		}

		// Process site
		if(this.choices.site){
			if(this.choices.vehicle){
				// See if the chosen vehicle can launch from this site
				for(var i = 0; i < this.data.vehicle[this.choices.vehicle].sites.length; i++){
					if(this.data.vehicle[this.choices.vehicle].sites[i] == s) ok = true;
				}
			}else{
				// No vehicle chosen so the site is actually OK
				ok = true;
			}
			if(!ok) this.errors.push({ 'text': this.phrases.errors.site.replace(/%SITE%/g,this.phrases.designer.site.options[s].label).replace(/%VEHICLE%/,this.phrases.designer.vehicle.options[v].label), 'link': '#designer_site' });
		}

		// If we have a vehicle and a mirror we work out if the satellite can fit
		if(this.choices.vehicle && this.choices.mirror){
			var fairing = this.copyValue(this.data.vehicle[this.choices.vehicle].diameter);
			var sylda = this.copyValue(this.data.mirror[this.choices.mirror].bus.diameter);
			if(this.choices.deployablemirror && this.data.deployablemirror.multiplier.bus.diameter) sylda.value *= this.data.deployablemirror.multiplier.bus.diameter;
			if(sylda.value > fairing.value) this.errors.push({ 'text': this.phrases.errors.size, 'link': '#designer_satellite' });
		}

		// Process orbit
		if(this.choices.orbit){
			ok = false;
			if(this.choices.site){
				ok = this.data.site[this.choices.site].orbits[o];
			}else{
				// No site chosen so the site is actually OK
				ok = true;
			}
			if(!ok) this.errors.push({ 'text': this.phrases.errors.orbit.replace(/%SITE%/g,this.phrases.designer.site.options[s].label).replace(/%ORBIT%/,this.phrases.designer.orbit.options[o].label), 'link': '#designer_orbit' });

			// Set temperature from orbit
			this.choices.temperature = this.copyValue(this.data.orbit[this.choices.orbit].temperature);
		}

		// Process cooling
		this.choices.cooling = {
			"cost": this.makeValue(0,'GBP'),
			"mass": this.makeValue(0,'kg'),
			"life": this.makeValue(99,'years'),
			"time": this.makeValue(0,'months'),
			"risk": 1
		}
		// Has the user requested cooling?
		if(this.choices.hascooling){
			// Do we have temperature-based cooling (normal mode)
			if(this.choices.cool.temperature){
				t = this.data.cooling.temperature[$('#cooling_temperature').val()];
				if(t.temperature) this.choices.temperature = this.copyValue(t.temperature);
				if(t.mass) this.choices.cooling.mass = this.sumValues(this.choices.cooling.mass,t.mass);
				if(t.cost) this.choices.cooling.cost = this.sumValues(this.choices.cooling.cost,t.cost);
				if(t.devtime) this.choices.cooling.time = this.sumValues(this.choices.cooling.time,t.devtime);
				if(t.life) this.choices.cooling.life = this.minValue(this.choices.cooling.life,t.life);
				if(t.risk) this.choices.cooling.risk *= t.risk;
				if(this.choices.mirror && this.data.mirror[m]['passive']){
					this.choices.cooling.mass = this.sumValues(this.choices.cooling.mass,this.data.mirror[m]['passive'].mass);
					this.choices.cooling.cost = this.sumValues(this.choices.cooling.cost,this.data.mirror[m]['passive'].cost);
					this.choices.cooling.time = this.sumValues(this.choices.cooling.time,this.data.mirror[m]['passive'].devtime);
				}
			}

			// Do we have passive cooling
			if(this.data.cooling.passive){
				p = this.choices.cool.passive;
				if(p=="yes"){
					this.choices.cooling.time = this.sumValues(this.choices.cooling.time,this.data.cooling.passive[p].devtime);
					if(this.choices.mirror && this.data.mirror[this.choices.mirror].passive){
						this.choices.cooling.mass = this.sumValues(this.choices.cooling.mass,this.data.mirror[this.choices.mirror].passive.mass);
						this.choices.cooling.passive = this.data.mirror[this.choices.mirror].passive.mass;
						this.choices.cooling.cost = this.sumValues(this.choices.cooling.cost,this.data.mirror[this.choices.mirror].passive.cost);
					}
					this.choices.cooling.mass.value *= this.data.cooling.passive[p].multiplier.mass;
					this.choices.cooling.cost.value *= this.data.cooling.passive[p].multiplier.cost;
					this.choices.cooling.risk *= this.data.cooling.passive[p].risk;
					this.choices.temperature.value *= this.data.cooling.passive[p].multiplier.temperature;
					if(this.data.cooling.passive[p].life) this.choices.cooling.life = this.minValue(this.choices.cooling.life,this.data.cooling.passive[p].life);
					if(this.choices.orbit){
						this.choices.cooling.life.value *= this.data.orbit[this.choices.orbit].multiplier.passive.time;
						if(this.data.orbit[this.choices.orbit].multiplier.cryo.time==0) this.errors.push({ 'text': this.phrases.errors.hotorbitpassive, 'link': '#designer_orbit' });
					}
					// Do we have active cooling (requires passive cooling)?
					if(this.data.cooling.active){
						p = this.choices.cool.active;
						if(p=="yes"){
							this.choices.cooling.time = this.sumValues(this.choices.cooling.time,this.data.cooling.active[p].devtime);
							this.choices.cooling.cost = this.sumValues(this.choices.cooling.cost,this.data.cooling.active[p].cost);
							this.choices.cooling.mass = this.sumValues(this.choices.cooling.mass,this.data.cooling.active[p].mass);
							this.choices.cooling.active = this.data.cooling.active[p].mass;
							this.choices.cooling.risk *= this.data.cooling.active[p].risk;
							this.choices.temperature.value *= this.data.cooling.active[p].multiplier.temperature;
							if(this.data.cooling.active[p].life) this.choices.cooling.life = this.minValue(this.choices.cooling.life,this.data.cooling.active[p].life);
						}
					}
					this.choices.cooling.cryogeniclife = 0;
					// Do we have cryogenic cooling (requires passive cooling)?
					if(this.data.cooling.cryogenic){
						p = this.choices.cool.cryogenic;
						if(p && p!="none"){
							this.choices.cooling.time = this.sumValues(this.choices.cooling.time,this.data.cooling.cryogenic[p].devtime);
							this.choices.cooling.cost = this.sumValues(this.choices.cooling.cost,this.data.cooling.cryogenic[p].cost);
							this.choices.cooling.mass = this.sumValues(this.choices.cooling.mass,this.data.cooling.cryogenic[p].mass);
							this.choices.cooling.cryogenic = this.data.cooling.cryogenic[p].mass;
							this.choices.cooling.risk *= this.data.cooling.cryogenic[p].risk;
							this.choices.temperature.value *= this.data.cooling.cryogenic[p].multiplier.temperature;
							if(this.data.cooling.cryogenic[p].life){
								this.choices.cooling.life = this.minValue(this.choices.cooling.life,this.data.cooling.cryogenic[p].life);
								this.choices.cooling.cyrogeniclife = this.convertValue(this.data.cooling.cryogenic[p].life,"years");
								this.choices.cooling.cyrogeniclife = this.choices.cooling.cyrogeniclife.value;
							}
							if(this.choices.orbit){
								this.choices.cooling.life.value *= this.data.orbit[this.choices.orbit].multiplier.cryo.time;
								var mt = this.data.orbit[this.choices.orbit].multiplier.cryo.time;
								if(mt==0) this.errors.push({ 'text': this.phrases.errors.hotorbitcryo, 'link': '#designer_orbit' });
								if(mt < 1 && mt > 0) this.warnings.push({ 'text': this.phrases.warnings.warmorbitcryo, 'link': '#designer_orbit' });
							}
						}
					}
				}else{
					// Warnings if the user has requested active or cryogenic cooling but no passive cooling selected
					if(this.data.cooling.active && this.getValue('input[name=cooling_active]:checked')=="yes" && p=="no") this.warnings.push({ 'text': this.phrases.warnings.activenopassive, 'link': '#designer_cooling' });
					if(this.data.cooling.cryogenic && this.getValue('#cooling_cryogenic')!="none" && p=="no") this.warnings.push({ 'text': this.phrases.warnings.cryonopassive, 'link': '#designer_cooling' });
				}
			}
		}

		// Error if the temperature achieved is not suitable for the instruments 
		var a = this.convertValue(this.choices.instrument.temp,'K');
		var b = this.convertValue(this.choices.temperature,'K');
		if(b.value > a.value) this.errors.push({ 'text': this.phrases.errors.temperature.replace(/%TEMPERATURE%/,'<strong>'+this.formatValue(b)+'</strong>').replace(/%REQUIREMENT%/,'<strong>'+this.formatValue(a)+'</strong>'), 'link': '#designer_cooling' });

		if(this.proposalCompleteness() < 1) this.warnings.push({ 'text': this.phrases.warnings.proposal, 'link': '#designer_proposal' })

		this.updateSummary().updateSidePanels().updateMessages("error",this.errors).updateMessages("warning",this.warnings);

		return this;
	}

	
	SpaceTelescope.prototype.updateMessages = function(category,e){

		this.log('updateMessages',e)
		if(category != "error" && category != "warning") return this;

		var li = '';
		var v = 0;
		if(e && typeof e=="object" && e.length > 0){
			v = e.length;
			for(var i = 0 ; i < e.length; i++) li += '<li>'+e[i].text+(e[i].link ? ' <a href="'+e[i].link+'">'+this.phrases.ui[category].link+'</a>' : '')+'</li>';
		}
		
		// Update the values
		$('.'+category+'.value').html(v);
		$('#messages h3.'+category).next().html(li);

		// Toggle if there are no messages in this category
		if(v == 0) $('.toggle'+category+',.'+category+'s').hide();
		else $('.toggle'+category+',.'+category+'s').show();
		
		return this;
	}
	
	SpaceTelescope.prototype.toggleView = function(view,e){

		this.log('toggleView',view)

		if(!$('#'+view).is(':visible')) this.showView(view,e);
		else this.showView(e);

		return this;
	}

	SpaceTelescope.prototype.showView = function(view,e){

		this.log('showView',view,e)

		if(typeof view==="object"){
			e = view;
			view = '';
		}

		if(typeof view!=="string") view = "";

		// Don't do anything for certain views
		if(view=="messages" || view=="menu" || view=="language" || view=="options" || view.indexOf("summaryext")==0){
			if(e && typeof e==="object" && typeof e.preventDefault==="function") e.preventDefault();
			if(view=="options"){
				if(e) e.preventDefault();
				this.updateOptions();
				$('#summaryext').hide();
				this.showModal($('#options'));
				$('body').addClass('showoptions');
			
			}
			return this;
		}

		// Hide everything
		$('.view').hide();

		$('body').removeClass('showguide showintro showoptions showmessages');

		// Less restrictive than before; if no scenario has been picked we go to the intro
		if(view.indexOf('designer')==0 && !this.scenario) view = "intro";

		// Process view
		if((view.indexOf('guide')==0 && view.length==5) || view.indexOf('guide_')==0){
			$('#summaryext').hide();
			this.showGuide(view);
			$('#guide').show().find('a').eq(0).focus();
			this.updateBodyClass('showguide');
		}else if((view.indexOf('designer')==0 && view.length==8) || view.indexOf('designer_')==0){
			$('#summaryext').hide();
			if(view.indexOf('designer_')==0){
				var section = view.substr(view.indexOf('designer_')+9)
				$('#menubar li').removeClass('on');
				$('#menubar a.toggle'+section).parent().addClass('on');
				$('.designer .designer_content').hide();
				$('#'+view+' .designer_content').show();
				$('#designer').show();
				if($('#'+view).find('a').is(':visible')) $('#'+view).find('a:visible').eq(0).focus();
				else{
					if($('#'+view).find('input')) $('#'+view).find('input').eq(0).focus(); 
					else $('#menubar a.toggle'+section).focus();
				}
				if(section=="orbit") this.makeSpace().displayOrbits();
				else this.removeOrbits();
				
				if(section=="proposal") this.updateProposal();

			}else{
				$('#designer').show().find('a').eq(0).focus();
			}
			this.updateBodyClass('showdesigner');
			this.setScroll('#'+view);
			this.stage = "designer";
		}else if(view=="intro"){
			$('#summaryext').hide();
			$('#intro').show();
			this.updateBodyClass('showintro');
			this.stage = "intro";
			this.startup();
		}else if(view=="scenarios"){
			$('#summaryext').hide();
			$('#scenarios').show();
			this.updateBodyClass('showscenarios');
			this.stage = "scenarios";
		}else if(view=="launch"){
			$('#summaryext').hide();
			this.updateMessages("error",{}).updateMessages("warning",{});
			this.updateBodyClass('showlaunch');
			this.goForLaunch();
			this.stage = "launch";
		}else{
			$('#'+this.stage).show();
			this.updateBodyClass('show'+this.stage);
		}

		if(this.pushstate && !e) history.pushState({},"Guide","#"+view);

		return this;
	}

	SpaceTelescope.prototype.setScroll = function(el){
		this.log('setScroll',el)
		var b = $('#bar');
		var offset = (b.is(':visible')) ? b.outerHeight() : 0;
		var t = 0;
		if(el && $(el).length == 1){
			t = Math.floor($(el).offset().top - offset);
			if(t < 0) t = 0;
		}
		$(window).scrollTop(t);

		return this;
	}

	SpaceTelescope.prototype.toggleGuide = function(key,e){

		this.log('toggleGuide',key)
		if(typeof key==="object"){
			e = key;
			key = "";
		}

		if(!$('#guide').is(':visible')){
			if(!key) key = "guide";
			this.showView(key);
		}else this.showView();

		return this;
	}

	SpaceTelescope.prototype.closeGuide = function(){
		this.log('closeGuide')
		$('body').removeClass('showguide');
		$('#guide').hide();
		$('#intro').show();
		return this;
	}

	SpaceTelescope.prototype.showGuide = function(key){

		this.log('showGuide',key)
		var origkey = key;

		// Split the input by '.'
		if(typeof key==="string"){
			var a = key.split('_');
			if(a.length > 1 && this.phrases.guide[a[1]]) key = a[1];
		}

		var html = "";
		var g = this.phrases.guide;
		var v,ul,table,txt,q;


		if(key){

			$('body').addClass('showguide');
			$('#guide').show();

			if($('#guide').length == 0) $('#page').append('<div id="guide" class="view"></div>')


			if(key=="guide"){
			
				html += '<h2>'+this.phrases.guide.title+'</h2><p>'+this.phrases.guide.about+'</p><ul class="index">';
				for(k in this.phrases.guide){
					if(k != "title" && k != "about" && typeof this.phrases.guide[k].title==="string"){
						html += '<li><a href="#guide_'+k+'" class="guidelink">'+this.phrases.guide[k].title+'</a><br />'+(typeof this.phrases.guide[k].summary==="string" ? this.phrases.guide[k].summary : "")+'</li>';
					}
				}
				html += '</ul>'
			
			}else if(g[key]){

				html += '<div class="guidetop"><span class="breadcrumb"><a href="#guide" class="guidelink">'+g.title+'</a> &raquo; '+g[key].title+'</span></div>'
	
				txt = g[key].about;
				if(key=="mirror"){
					table = '';
					for(i in this.data.mirror){
						table += '<tr>';
						table += '<td>'+this.formatValue(this.data.mirror[i].diameter)+'</td>';
						table += '<td>'+this.formatValue(this.data.mirror[i].mass)+'</td>';
						table += '<td>'+this.formatValue(this.data.mirror[i].cost)+'</td>';
						if(this.settings.mode=="advanced") table += '<td>'+this.formatValue(this.data.mirror[i].devtime)+'</td>';
						table += '</tr>';
					}
					txt = txt.replace(/\%MIRRORTABLE\%/,table);
				}else if(key=="structure"){
					table = '';
					for(i in this.data.mirror){
						table += '<tr>';
						table += '<td>'+this.formatValue(this.data.mirror[i].diameter)+'</td>';
						table += '<td>'+this.formatValue(this.data.mirror[i].bus.diameter)+'</td>';
						table += '<td>'+this.formatValue(this.data.mirror[i].bus.cost)+'</td>';
						table += '<td>'+this.formatValue(this.data.mirror[i].bus.mass)+'</td>';
						table += '</tr>';
					}
					txt = txt.replace(/\%STRUCTURETABLE\%/,table);
				}else if(key=="cooling"){
					table = '';
					if(this.settings.mode=="advanced"){
						for(i in this.data.cooling.cryogenic){
							if(i != "none"){
								table += '<tr>';
								table += '<td>'+this.formatValue(this.data.cooling.cryogenic[i].life)+'</td>';
								table += '<td>'+this.formatValue(this.data.cooling.cryogenic[i].cost)+'</td>';
								table += '<td>'+this.formatValue(this.data.cooling.cryogenic[i].mass)+'</td>';
								table += '</tr>';
							}
						}
						txt = txt.replace(/\%ACTIVELIFE\%/,this.formatValue(this.data.cooling.active.yes.life));
						txt = txt.replace(/\%ACTIVEMASS\%/,this.formatValue(this.data.cooling.active.yes.mass));
						txt = txt.replace(/\%ACTIVECOST\%/,this.formatValue(this.data.cooling.active.yes.cost));
	
					}else{
						for(i in this.data.cooling.temperature){
							table += '<tr>';
							table += '<td>'+this.formatValue(this.data.cooling.temperature[i].temperature)+'</td>';
							table += '<td>'+this.formatValue(this.data.cooling.temperature[i].cost)+'</td>';
							table += '<td>'+this.formatValue(this.data.cooling.temperature[i].mass)+'</td>';
							table += '</tr>';
						}
					}
					txt = txt.replace(/\%COOLINGTABLE\%/,table);
				}else if(key=="instruments"){
					table = '';
	
					for(i in this.data.wavelengths){
						if(i != "none"){
							table += '<tr>';
							table += '<td>'+this.phrases.wavelengths[i].label+'</td>';
							table += '<td>'+this.formatValue(this.data.wavelengths[i].temperature)+'</td>';
							table += '</tr>';
						}
					}
					txt = txt.replace(/\%WAVELENGTHTABLE\%/,table);
	
					if(this.settings.mode=="advanced"){
						table = '';
						for(i in this.data.instrument.options){
							if(i != "none"){
								table += '<tr>';
								table += '<td>'+this.phrases.designer.instruments.options.instrument[i].label+'</td>';
								table += '<td>'+this.formatValue(this.data.instrument.options[i].multiplier.mass)+'</td>';
								table += '<td>'+this.formatValue(this.data.instrument.options[i].multiplier.cost)+'</td>';
								table += '<td>'+this.formatValue(this.data.instrument.options[i].devtime)+'</td>';
								table += '</tr>';
							}
						}
						txt = txt.replace(/\%INSTRUMENTTABLE\%/,table);
					}
				}else if(key=="orbit"){
					table = '';
					for(i in this.data.orbit){
						table += '<tr>';
						table += '<td>'+this.phrases.designer.orbit.options[i].label+'</td>';
						table += '<td>'+(this.phrases.designer.orbit.options[i].altitude ? this.phrases.designer.orbit.options[i].altitude : '')+this.formatValue(this.data.orbit[i].altitude,0)+'</td>';
						table += '<td>'+this.formatValue(this.data.orbit[i].period)+'</td>';
						table += '<td>'+(this.data.orbit[i].obsfrac*100)+'%</td>';
						table += '<td>'+this.formatValue(this.data.orbit[i].temperature)+'</td>';
						table += '</tr>';
					}
					txt = txt.replace("%ORBITTABLE%",table);
					for(i in this.data.orbit){
						txt = txt.replace("%"+i+"ANCHOR%",'guide_orbit_'+i);
						txt = txt.replace("%"+i+"LABEL%",this.phrases.designer.orbit.options[i].label);
						txt = txt.replace("%"+i+"GROUNDCOST%",this.formatValue(this.data.orbit[i].groundcost));
						txt = txt.replace("%"+i+"FUELLIFE%",this.formatValue(this.data.orbit[i].fuellife));
						txt = txt.replace("%"+i+"ALTITUDE%",this.formatValue(this.data.orbit[i].altitude));
						txt = txt.replace("%"+i+"PERIOD%",this.formatValue(this.data.orbit[i].period));
						txt = txt.replace("%"+i+"CRYOREDUCTION%",(100*(1-this.data.orbit[i].multiplier.cryo)).toFixed(0)+"%");
					}
				}else if(key=="vehicle"){
					table = '';
					for(i in this.data.vehicle){
						table += '<tr>';
						table += '<td>'+this.phrases.designer.vehicle.options[i].label+'</td>';
						table += '<td>'+this.formatValue(this.data.vehicle[i].diameter,0)+'</td>';
						table += '<td>'+this.formatValue(this.data.vehicle[i].mass.LEO,0)+'</td>';
						table += '<td>'+this.formatValue(this.data.vehicle[i].mass.GTO,0)+'</td>';
						table += '<td>'+this.formatValue(this.data.vehicle[i].cost,0)+'</td>';
						table += '<td>'+this.phrases.operator[this.data.vehicle[i].operator].label+'</td>';
						if(this.settings.mode=="advanced") table += '<td>'+(this.data.vehicle[i].risk*100)+'%</td>';
						table += '</tr>';
					}
					txt = txt.replace(/\%ROCKETTABLE\%/,table);
				}else if(key=="site"){
					table = '';
					for(i in this.data.site){
						table += '<tr>';
						table += '<td>'+this.phrases.designer.site.options[i].label+'</td>';
						table += '<td>'+this.phrases.designer.site.options[i].trajectories+'</td>';
						table += '<td>';
						var rs = '';
						for(var r in this.data.vehicle){
							for(var s=0; s < this.data.vehicle[r].sites.length; s++){
								if(this.data.vehicle[r].sites[s]==i){
									if(rs.length > 0) rs += ', ';
									rs += ''+this.phrases.designer.vehicle.options[r].label+''
								}
							}
						}
						table += rs;
						table += '</td>';
						table += '</tr>';
					}
					txt = txt.replace(/\%SITETABLE\%/,table);
				}
	
				// Wrap in a paragraph tag if it isn't already
				if(txt.indexOf('<p>') < 0) txt = '<p>'+txt+'</p>';

				// Add any questions

				html += '<h2 id="guide_'+key+'">'+g[key].title+'</h2>'+txt+'<div class="clearall" /></div>';
	
				if(key=="roles"){
					for(k in g[key]){
						if(k != "title" && k != "about" && typeof g[key][k].title==="string"){
							html += '<h3>'+g[key][k].title+'</h3><p>'+g[key][k].about+'</p>';
						}
					}
				}else if(key=="previous"){
					for(k in g[key]["missions"]){
						if(typeof g[key]["missions"][k].title==="string"){
							ul = '<ul>';
							for(i in g[key]["missions"][k]){
								if(i != "title" && i != "image"){
									v = this.formatValue(g[key]["missions"][k][i]);
									ul += '<li><span class="key">'+g[key][i]+'</span> <span class="value">'+v+'</span></li>';
								}
							}
							ul += '</ul>';
							html += '<h3 id="guide_'+key+'_'+k+'">'+g[key]["missions"][k].title+'</h3>';
							if(g[key]["missions"][k]["image"]) html += '<figure class=\"right\"><img src="'+g[key]["missions"][k]["image"].src+'" alt="'+g[key]["missions"][k]["title"]+'" /><figcaption>'+g[key]["missions"][k]["title"]+'</figcaption></figure>';
							html += '';
							html += ul;
						}
					}
				}
			}

			if(g[key] && g[key].questions){
				q = '<h3 id="guide_'+key+'_questions">Questions</h3><ol>';
				for(i = 0; i < g[key].questions.length; i++){
					q += '<li>'+g[key].questions[i].label.replace('%EARTHRADIUS%',this.formatValue({value:6500,units:'km',dimension:'length'})).replace('%EARTHMASS%',this.formatValue({value:6e24,units:'kg',dimension:'mass'}))+'</li>'
				}
				q += '</ol>';
				html += q;
			}

			// Add closer
			$('#guide').html(html);

			if(html.indexOf('script')>= 0 && typeof MathJax==="object") MathJax.Hub.Queue(["Typeset",MathJax.Hub,'guide']);

			// Add events to guide close
			this.addCloser($('#guide'),{me:this},function(e){ e.preventDefault(); e.data.me.toggleGuide(); });

			var _obj = this;
			$('#guide').show(function(){ _obj.setScroll('#'+origkey); });
			$('#intro').hide();
	
		}else this.closeGuide();

		$('#guide').show().find('a').eq(0).focus();
		this.updateBodyClass('showguide');

		return this;
	}

	SpaceTelescope.prototype.updateBodyClass = function(cls){
		$('body').removeClass('showguide showintro showoptions showmessages showlaunch').addClass(cls);
		return this;
	}
	
	// Add a close button to the element
	// Inputs:
	//  el - jQuery DOM element
	//  data - the data to send to the click event
	//  fn - the callback function to attach to the click event
	SpaceTelescope.prototype.addCloser = function(el,data,fn){

		var a = location.href.split("#")[1];

		if(el.find('.close').length==0) el.prepend('<a href="#" class="close" title="Close"><img src="images/cleardot.gif" class="icon close" /></a>');

		// Update link to point back to the previous anchor tag
		if(el.attr('id')!="guide" && el.attr('id').indexOf(a)!=0) el.find('a.close').attr('href',"#"+a);

		// Add events to guide close
		el.find('a img.close').parent().on('click',data,fn);

		return this;
	}
	
	// Attempt to save a file
	// Blob() requires browser >= Chrome 20, Firefox 13, IE 10, Opera 12.10 or Safari 6
	SpaceTelescope.prototype.save = function(){

		// Bail out if there is no Blob function
		if(typeof Blob!=="function") return this;

		var textToWrite = "blah";
		var textFileAsBlob = new Blob([textToWrite], {type:'text/plain'});
		var fileNameToSaveAs = "spacetelescope.txt";
	
		function destroyClickedElement(event){ document.body.removeChild(event.target); }

		var downloadLink = document.createElement("a");
		downloadLink.download = fileNameToSaveAs;
		downloadLink.innerHTML = "Download File";
		if(window.webkitURL != null){
			// Chrome allows the link to be clicked
			// without actually adding it to the DOM.
			downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
		}else{
			// Firefox requires the link to be added to the DOM
			// before it can be clicked.
			downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
			downloadLink.onclick = destroyClickedElement;
			downloadLink.style.display = "none";
			document.body.appendChild(downloadLink);
		}
		downloadLink.click();

		return this;
	}

	SpaceTelescope.prototype.showModal = function(lb){
		var wide = $(window).width();
		var tall = $(window).height();
		var l = 0;
		var t = 0;

		// Set focus
		lb.show().find('a').eq(0).focus();

		this.positionModal(lb);

		this.modal = lb;

		return this;
	}

	SpaceTelescope.prototype.closeModal = function(lb){
		lb.hide();
		$('#modalbg').hide();
		$('body').css('overflow-y','auto');
		this.modal = undefined;

		return this;
	}

	SpaceTelescope.prototype.positionModal = function(lb){
		centre(lb);
		// Position background
		$('#modalbg').hide().css({left:0,top:0, height: $(document).height(), width: $(document).width() }).show().off('click').on('click',{me:this},function(e){ e.data.me.closeModal(lb); });
		return this;
	}

	// Attempt to save a file
	// Blob() requires browser >= Chrome 20, Firefox 13, IE 10, Opera 12.10 or Safari 6
	SpaceTelescope.prototype.log = function(){
		var args = Array.prototype.slice.call(arguments, 0);
		if(console && typeof console.log==="function") console.log('LOG',args);
		return this;
	}

	// Make an animated exhaust for a rocket.
	// Requires:
	//   * #launchrocket containing an <img>
	//   * #launchpadbg containing an <img>
	// Creates a <canvas> element (#launchexhaust) where the exhaust is drawn
	function Exhaust(){

		var rocket = $('#launchrocket img');
		var pad = $('#launchpadbg img');
		if($('#launchexhaust').length==0) rocket.before('<canvas id="launchexhaust"><\/canvas>');
		var canvas = document.getElementById("launchexhaust");
		var ctx = canvas.getContext("2d");
		this.active = true;
		
		// Make the canvas occupy the same space 
		var w = pad.innerWidth(), h = pad.innerHeight();
		canvas.width = w;
		canvas.height = h;
		
		var particles = [];
		var mouse = {};
		
		// Create some particles
		var particle_count = 80;
		for(var i = 0; i < particle_count; i++) particles.push(new particle());
			
		// Particle class
		function particle(){
			// The speed in both the horizontal and vertical directions
			this.speed = {x: -0.5+Math.random()*1, y: -5+Math.random()*3};
			// Set the source location to the bottom of the rocket
			this.location = { x: rocket.offset().left+(rocket.width()/2)-pad.offset().left, y: rocket.offset().top + rocket.height() - pad.offset().top };
			// Size of particle
			this.radius = 5+Math.random()*2;
			// How long it lasts
			this.life = 20+Math.random()*10;
			this.remaining_life = this.life;
			// Make it whitish grey
			this.r = Math.round(Math.random()*55 + 200);
			this.g = this.r;
			this.b = this.r;
		}
		// Keep a copy of ourselves to refer to within draw()
		var _obj = this;

		function draw(){

			// Set the canvas properties
			ctx.globalCompositeOperation = "source-over";
			ctx.fillStyle = "transparent";
			ctx.fillRect(0, 0, w, h);
			
			// Draw all the particles
			for(var i = 0; i < particles.length; i++){
				var p = particles[i];
				ctx.beginPath();
				// Changing opacity according to the life
				// i.e. opacity goes to 0 at the end of life
				p.opacity = Math.round(p.remaining_life/p.life*100)/100
				// Apply a gradient to make it darker around the edge
				var gradient = ctx.createRadialGradient(p.location.x, p.location.y, 0, p.location.x, p.location.y, p.radius);
				gradient.addColorStop(0, "rgba("+p.r+", "+p.g+", "+p.b+", "+p.opacity+")");
				gradient.addColorStop(0.5, "rgba("+p.r+", "+p.g+", "+p.b+", "+p.opacity+")");
				gradient.addColorStop(1, "rgba("+Math.round(p.r*0.9)+", "+Math.round(p.g*0.9)+", "+Math.round(p.b*0.9)+", 0)");
				ctx.fillStyle = gradient;
				// Draw particle
				ctx.arc(p.location.x, p.location.y, p.radius, Math.PI*2, false);
				ctx.fill();
				
				// Move the particles
				p.remaining_life -= 0.5;
				p.radius += 0.5;
				p.location.x += p.speed.x;
				p.location.y -= p.speed.y;
				
				// Regenerate the particles
				if(p.remaining_life < 0 || p.radius < 0){
					// A new particle to replace the old one
					particles[i] = new particle();
				}
			}
			// Request a new animation frame if we are still active
			if(_obj.active) requestAnimationFrame(draw);	
		}

		// Start the animation
		draw();

		return this;
	}

	// Function to stop the exhaust animation
	Exhaust.prototype.stop = function(){ this.active = false; }

	// Helper functions

	// Add commas every 10^3
	function addCommas(nStr) {
		nStr += '';
		var x = nStr.split('.');
		var x1 = x[0];
		var x2 = x.length > 1 ? '.' + x[1] : '';
		var rgx = /(\d+)(\d{3})/;
		while (rgx.test(x1)) {
			x1 = x1.replace(rgx, '$1' + ',' + '$2');
		}
		return x1 + x2;
	}

	function htmlDecode(input){
		return $('<div />').html(input).text();
	}
	
	function centre(lb){
		var wide = $(window).width();
		var tall = $(window).height();
		var l = 0;
		var t = 0;
		l = ((wide-lb.outerWidth())/2);
		lb.css({left:((wide-lb.outerWidth())/2)+'px'});
		if($(window).height() > lb.height()){
			//t = (window.scrollY+(tall-lb.outerHeight())/2);
			t = ((tall-lb.outerHeight())/2 + $(window).scrollTop());
			$('body').css('overflow-y','hidden');
		}
		lb.css({left:l+"px",top:t+'px','position':'absolute'});
	}
	
	// Update the transforms on a Raphael element
	function transformer(el,trans){
		t = el.data('transform');
		if(typeof t==="undefined") t = el.attr('transform');
		if(typeof t!=="object") t = [];
		m = false;
		for(i = 0; i < t.length ; i++){
			for(j = 0; j < trans.length ; j++){
				if(t[i][0] == trans[j][0]){
					t[i] = trans[j][0];
					m = true;
				}
			}
		}
		if(!m) t.push(trans);
		// Re-apply the transform
		// For some reason IE 8 has a bug in using .attr('transform') to get the transform.
		// As a work-around we make a function that stores the transform in .data('transform')
		el.transform(t).data('transform',t);
	}
	

	function makeYouTubeEmbed(video){
		if(!video.url) return "";
		video.url = video.url.replace(/watch\?v=/,'embed/');
		if(video.start && typeof video.start==="number"){
			video.url += '?start='+video.start;
			if(video.end && typeof video.end==="number") video.url += '&end='+video.end;
		}
		video.url += (video.url.indexOf('?')>0 ? "&" : "?")+"rel=0&autoplay=1";	// Don't show related videos at the end
		return '<iframe width="560" height="315" src="'+video.url+'" frameborder="0"></iframe>';
	}

	// Functions for getting, setting and deleting cookies
	function setCookie(name,value,days){
		if (days) {
			var date = new Date();
			date.setTime(date.getTime()+(days*24*60*60*1000));
			var expires = "; expires="+date.toGMTString();
		}
		else var expires = "";
		document.cookie = name+"="+value+expires+"; path=/";
	}
	
	function getCookie(name){
		var nameEQ = name + "=";
		var ca = document.cookie.split(';');
		for(var i=0;i < ca.length;i++) {
			var c = ca[i];
			while (c.charAt(0)==' ') c = c.substring(1,c.length);
			if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
		}
		return null;
	}
	
	function deleteCookie(name){ setCookie(name,"",-1); }
	


	$.spacetelescope = function(placeholder,input) {
		if(typeof input=="object") input.container = placeholder;
		else {
			if(placeholder){
				if(typeof placeholder=="string") input = { container: placeholder };
				else input = placeholder;
			}else{
				input = {};
			}
		}
		input.plugins = $.spacetelescope.plugins;
		return new SpaceTelescope(input);
	};

	$.spacetelescope.plugins = [];

})($);
