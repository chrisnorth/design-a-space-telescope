/*!
	SpaceTelescope
	(c) Stuart Lowe and Chris North 2014-5
*/
/*
	USAGE:
		<script src="js/jquery-1.10.0.min.js" type="text/javascript"></script>
		<script src="js/spacetelescope.min.js" type="text/javascript"></script>
		<script type="text/javascript"><!--
		$(document).ready(function(){
			spacetel = $.spacetelescopedesigner({});
		});
		// --></script>
*/

if(typeof $==="undefined") $ = {};

(function($) {

	// Add Math.log10 function if it doesn't exist
	if(!is(Math.log10,"function")) Math.log10 = function(v) { return Math.log(v)/2.302585092994046; };


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
	if(typeof document.cancelFullScreen != 'undefined'){
		fullScreenApi.supportsFullScreen = true;
	}else{
		// check for fullscreen support by vendor prefix
		for(var i = 0, il = browserPrefixes.length; i < il; i++ ){
			fullScreenApi.prefix = browserPrefixes[i];
			if (typeof document[fullScreenApi.prefix + 'CancelFullScreen' ] != 'undefined' ) {
				fullScreenApi.supportsFullScreen = true;
				break;
			}
		}
	}
	// update methods to do something useful
	if(fullScreenApi.supportsFullScreen){
		fullScreenApi.fullScreenEventName = fullScreenApi.prefix + 'fullscreenchange';
		fullScreenApi.isFullScreen = function(){
			switch (this.prefix) {
				case '':
					return document.fullScreen;
				case 'webkit':
					return document.webkitIsFullScreen;
				default:
					return document[this.prefix + 'FullScreen'];
			}
		}
		fullScreenApi.requestFullScreen = function(el){
			return (this.prefix === '') ? el.requestFullScreen() : el[this.prefix + 'RequestFullScreen']();
		}
		fullScreenApi.cancelFullScreen = function(el){
			return (this.prefix === '') ? document.cancelFullScreen() : document[this.prefix + 'CancelFullScreen']();
		}
	}
	// jQuery plugin
	if(typeof jQuery != 'undefined'){
		jQuery.fn.requestFullScreen = function(){
			return this.each(function(){
				if(fullScreenApi.supportsFullScreen) fullScreenApi.requestFullScreen(this);
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
		element.zforward = (!is(z,"boolean")) ? false : z;
		element.atFront = false;
		element.path = path;
		element.direction = direction;
		element.pathLen = element.path.getTotalLength();    
		duration = (is(duration,"undefined")) ? 5000 : duration;
		repetitions = (is(repetitions,"undefined")) ? 1 : repetitions;
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
	 
		if(!window.requestAnimationFrame)
			window.requestAnimationFrame = function(callback, element) {
				var currTime = new Date().getTime();
				var timeToCall = Math.max(0, 16 - (currTime - lastTime));
				var id = window.setTimeout(function() { callback(currTime + timeToCall); },
				  timeToCall);
				lastTime = currTime + timeToCall;
				return id;
			};
	 
		if(!window.cancelAnimationFrame)
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
		this.languages = {'en':'en'};	// To avoid 404 errors trying to load languages we don't have

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
		this.lang = (is(this.q.lang,"string")) ? this.q.lang : (navigator) ? (navigator.userLanguage||navigator.systemLanguage||navigator.language||browser.language) : "";
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

		// Deal with drag and dropping of files
		$(document).on('dragenter','#application',function(e){ e.preventDefault(); });	
		$(document).on('dragover','#application',function(e){ e.preventDefault(); $(this).css('opacity',0.75); });
		$(document).on('drop',function(e){ e.preventDefault(); });

		function readFile(files,_obj){
			// Only process one file
			if(files[0].type=="text/plain" || files[0].type==""){
				var reader = new FileReader();
				// Closure to capture the file information.
				reader.onload = (function(theFile){ return function(e) { _obj.processFile(e.target.result).toggleMenus(); }; })(files[0]);
				// Read in the text file
				reader.readAsText(files[0]);
			}
		}
		$(document).on('drop','#application',{me:this},function(e){
			e.preventDefault();
			$(this).css({'opacity':1});	// Set the opacity back
			var files = e.originalEvent.dataTransfer.files;
			readFile(files,e.data.me);
			return false;     
		});
		if(is(Blob,"function")){
			// Add load to menu
			$('#menu ul').append('<li class="baritem" data="load"><a href="#"><img src="images/cleardot.gif" class="icon load" alt="" /><span>Load</span></a><input type="file" id="files" name="files[]" multiple /></li>');
			$(document).on('change','#files',{me:this},function(e){
				readFile(e.target.files,e.data.me);
			})
			// Add save to menu
			$('#menu ul').append('<li class="baritem" data="save"><a href="#"><img src="images/cleardot.gif" class="icon save" alt="" /><span>Save</span></a></li>');
		}
		// Add fullscreen to menu
		if(fullScreenApi.supportsFullScreen){
			// Add the fullscreen toggle to the menu
			$('#menu ul').append('<li class="baritem" data="fullscreen"><a href="#" class="fullscreenbtn"><img src="images/cleardot.gif" class="icon fullscreen" alt="" /> <span></span></li>');
			// Bind the fullscreen function to the double-click event if the browser supports fullscreen
			$('.baritem .fullscreenbtn').parent().on('click', {me:this}, function(e){ e.data.me.toggleFullScreen().toggleMenus(); });
		}
		// Add main menu events
		$('.baritem .load').parent().on('click',{me:this},function(e){ $('#files').trigger('click'); });
		$('.baritem .save').parent().on('click',{me:this},function(e){ e.data.me.save().toggleMenus(); });
		$('.baritem .help').parent().on('click',{me:this},function(e){ e.data.me.toggleGuide(e).toggleMenus(); });
		$('.baritem .restart').parent().on('click',{me:this},function(e){ e.data.me.toggleMenus(); });
		$('.baritem .options').parent().on('click',{me:this},function(e){ e.data.me.showView('options',e).toggleMenus(); });


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
			var input = $(this).find('input:checked');
			
			if(input.attr('value')=="yes") $(this).addClass('checked');
			else $(this).removeClass('checked');

			if(input.attr('id').indexOf('mode')==0){
				var nmode = (input.attr('value')=="yes" ? "advanced" : "normal");
				if(e.data.me.settings.mode != nmode) e.data.me.setMode(nmode);
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

	SpaceTelescope.prototype.startup = function(fn){

		this.data = null;
		this.phrases = null;
		this.choices = {};
		this.scenarios = null;
		this.buildTable();
		if(is(fn,"function")) fn = [this.update,fn];
		else fn = [this.update];
		
		this.loadConfig();
		this.loadLanguage(this.lang,fn);

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


	SpaceTelescope.prototype.setMode = function(m,fn){
		this.settings.mode = m;
		this.q.mode = m;
		this.startup(fn);
	}

	SpaceTelescope.prototype.changeMode = function(m){
		this.changeToggle('togglemode','mode_'+m);
		return this;
	}
	
	// Change a toggle
	// Inputs:
	//   id = (string) The toggle ID
	//   v  = (string) The option to set to
	SpaceTelescope.prototype.changeToggle = function(id,v){
		var t = this.toggles[id];
		if(!t) return this;
		if(v==t.a.id && $('#'+t.a.id).length>0) $('#'+t.a.id).trigger('click').closest('.toggler').trigger('click');
		if(v==t.b.id && $('#'+t.a.id).length>0) $('#'+t.b.id).trigger('click').closest('.toggler').trigger('click');
		return this;
	}

	// Build a toggle button
	// Inputs
	//   a = { "value": "a", "id": "uniqueid_a", "checked": true }
	//   b = { "value": "b", "id": "uniqueid_b", "checked": false }
	SpaceTelescope.prototype.buildToggle = function(id,a,b){

		if(!is(id,"string") && !is(a,"object") && !is(b,"object")) return "";
		if(!this.toggles) this.toggles = {};
		this.toggles[id] = {'a':a,'b':b};
		var lc = '<label class="toggle-label';
		if(a.checked) html = '<div class="toggleinput toggler">'+lc+'1" for="'+a.id+'"></label>';
		else html = '<div class="toggleinput toggler checked">'+lc+'1" for="'+a.id+'"></label>';
		html += '<div class="toggle-bg">';
		html += '	<input id="'+a.id+'" type="radio" '+(a.checked ? 'checked="checked" ' : '')+'name="'+id+'" value="'+a.value+'">';
		html += '	<input id="'+b.id+'" type="radio" '+(b.checked ? 'checked="checked" ' : '')+'name="'+id+'" value="'+b.value+'">';
		html += '	<span class="switch"></span>';
		html += '</div>';
		html += ''+lc+'2" for="'+b.id+'"></label></div>';

		return html;
	}

	// Update the text of a toggle input
	// Inputs:
	//   a = { "id": "ID", "value": "value", "label": "The displayed label A" }
	//   b = { "id": "ID", "value": "value", "label": "The displayed label B" }
	//   title = A title
	SpaceTelescope.prototype.updateToggle = function(a,b,title){
		if(!is(a,"object") && !is(b,"object") || $('#'+a.id).length==0 || $('#'+b.id).length==0) return this;
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
		$('#designer_orbit .options').html('<div id="orbits"></div><div id="orbits2"></div><div class="bigpadded"><form><ul><li><label for="mission_orbit"></label><select id="mission_orbit" name="mission_orbit"></select></li><li><label for="mission_duration"></label><select id="mission_duration" name="mission_duration"></select></li></ul></form><div class="details"></div></div>');

		// Build proposal document holder
		$('#designer_proposal .options').html('<div class="padded"><div class="doc"></div></div>');

		$('#sidebar').html('<div class="sidebar_inner"><div class="satellite panel" id="sidebar_satellite"></div><div class="vehicle padded panel"></div><div class="site worldmap panel"></div><div class="orbit panel"></div></div>');

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
		if($('#launchanimation').length > 0) $('#launchanimation').css({'height':($('#launchanimation').innerWidth()/2)+'px'});

		return this;
	}
	
	// Work out where we are based on the anchor tag
	SpaceTelescope.prototype.navigate = function(e,a){
		if(!a) var a = location.href.split("#")[1];
		this.log('navigate',a,e);
		if(!is(a,"string")) a = "";
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
		if(!is(fn,"function")) return this;
		if(!is(charCode,"object")) charCode = [charCode];
		var aok, ch, c, i, alt, str;
		for(c = 0 ; c < charCode.length ; c++){
			alt = false;
			if(is(charCode[c],"string")){
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

		if(e && is(e,"object")) e.preventDefault();
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
		if(is(v,"string")){
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
				if(is(fn,"function")) fn.call(this);
				if(is(fn,"object") && fn.length > 0){
					for(var f = 0; f < fn.length; f++) fn[f].call(this);
				}
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
		// Limit ourselves to languages we know we have
		if(!this.languages[l]){
			l = this.langshort;
			if(this.languages[this.langshort]) l = "en";
		}
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
			error: function(){ this.log('Error loading '+l+' ('+m+')'); },
			success: function(data){
				this.langshort = l;
				this.lang = l;
				// Store the data
				this.phrases = data;
				this.log('Loaded '+l)
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
				if(is(fn,"function")) fn.call(this);
				if(is(fn,"object") && fn.length > 0){
					for(var f = 0; f < fn.length; f++) fn[f].call(this);
				}
			},
			success: function(data){
				this.scenarios = data.scenarios;
				this.log('Loaded Scenario')
				if(is(fn,"function")) fn.call(this);
				if(is(fn,"object") && fn.length > 0){
					for(var f = 0; f < fn.length; f++) fn[f].call(this);
				}
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

		this.buildPage().updateLanguage().makeSpace('orbits').displayOrbits();

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
			this.choices.instruments.push({'name':n,'type':i,'wavelength':w,'ok':true});
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

		if(!this.satellite) this.satellite = new Satellite({'id':'sidebar_satellite','spacetel':this});
		this.satellite.resize();

		return this;
	}
	
	// Create an animation area for the orbit animations
	SpaceTelescope.prototype.makeSpace = function(id){

		this.log('makeSpace')

		if(!this.space){
			this.space = new OrbitAnimation({'id':id,'phrases':this.phrases.designer.orbit,'data':this.data.orbit,'callback':this.selectOrbit,'context':this,'interactive':true});
		}
		if(!this.space.el.is(':visible')) return this;
		// Update the data and phrasebook
		this.space.data = this.data.orbit;
		this.space.phrases = this.phrases.designer.orbit;
		if(!this.space.paper){
			this.space.resize();
		}

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
		this.space.highlight(key);

		return this;
	}

	SpaceTelescope.prototype.removeOrbits = function(){
		this.space.removeOrbits();
		return this;
	}

	SpaceTelescope.prototype.displayOrbits = function(key,zoom){

		this.log('displayOrbits',key,zoom);
		
		this.space.displayOrbits(key,zoom);
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
		return (!name && !value && !cls) ? '' : '<div'+(is(cls,"string") ? ' class="'+cls+'"' : '')+'><strong>'+name+'</strong> '+this.formatValueSpan(value)+'</div>';
	}

	// Show the detail panel for the area/value
	SpaceTelescope.prototype.showDetails = function(area,value){

		this.log('showDetails')
		var html = '';
		if(!area || area == "") return this;
		var d,dt,m,mu,s,i,c,ch,o;
		
		d = this.phrases.designer;
		dt = this.data;
		ch = this.choices;

		if(area=="satellite"){

			if(ch.mirror && dt.mirror[ch.mirror]){
				m = dt.mirror[ch.mirror];
				var cost = this.copyValue(m.cost);
				var mass = this.copyValue(m.mass);
				var time = this.copyValue(m.devtime);
				var buscost = this.copyValue(m.bus.cost);
				var busmass = this.copyValue(m.bus.mass);
				var bustime = this.copyValue(m.bus.devtime);
				var busdiam = this.copyValue(m.bus.diameter);
				
				// Applies to both mirror and bus
				if(ch.deployablemirror){
					mu = dt.deployablemirror.multiplier;
					if(mu.cost) cost.value *= mu.cost;
					if(mu.mass) mass.value *= mu.mass;
					if(mu.time) time.value *= mu.time;
					if(mu.bus.cost) buscost.value *= mu.bus.cost;
					if(mu.bus.mass) busmass.value *= mu.bus.mass;
					if(mu.bus.time) bustime.value *= mu.bus.time;
					if(mu.bus.diameter) busdiam.value *= mu.bus.diameter;
				}
				// If we have a UV mirror we apply the cost/mass/time multipliers
				if(ch.uvmirror){
					mu = dt.uvmirror.multiplier;
					if(mu.cost) cost.value *= mu.cost;
					if(mu.mass) mass.value *= mu.mass;
					if(mu.time) time.value *= mu.time;
				}
				s = d.satellite;
				html += this.buildRow(s.cost,cost);
				html += this.buildRow(s.mass,mass);
				html += this.buildRow(s.devtime,time);
				html += this.buildRow(s.bus.cost,buscost);
				html += this.buildRow(s.bus.mass,busmass);
				html += this.buildRow(s.bus.devtime,bustime);
				html += this.buildRow(s.bus.diameter,busdiam);
				html += this.buildRow(s.bus.slots,m.bus.instrumentslots);
			}

		}else if(area=="instruments"){

			value = this.getInstrument(value);
			i = d.instruments;
			html += this.buildRow(i.cost,value.cost)
			html += this.buildRow(i.mass,value.mass)
			html += this.buildRow(i.temperature,value.temp)
			html += this.buildRow(i.devtime,value.time)

		}else if(area=="cooling"){

			var c = d.cooling;
			html += this.buildRow(c.temperature,ch.temperature);
			html += this.buildRow(c.cost,ch.cooling.cost);
			html += this.buildRow(c.mass,ch.cooling.mass);
			if(ch.cooling.time.value > 0) html += this.buildRow(d.cooling.devtime,ch.cooling.time);
			html += this.buildRow(c.life,ch.cooling.life);
			html += this.buildRow(c.risk,this.makeValue(ch.cooling.risk*100,'%'));

		}else if(area=="site"){

			if(is(dt.site[value].latitude,"number")) html += this.buildRow(d.site.location,dt.site[value].latitude.toFixed(2)+'&deg;, '+dt.site[value].longitude.toFixed(2)+'&deg;');
			if(dt.site[value].operator) html += this.buildRow(d.site.operator,this.phrases.operator[dt.site[value].operator].label);
			html += this.buildRow(d.site.trajectories,d.site.options[value].trajectories);
			var sitenames = '';
			for(var o in dt.site[value].orbits){
				if(dt.site[value].orbits[o]) sitenames += ''+d.orbit.options[o].label+'<br />';
			}
			html += this.buildRow(d.site.orbits,sitenames);
			
			if(is(dt.site[value].risk,"number")) html += this.buildRow(d.site.risk,(dt.site[value].risk*100).toFixed(0)+'%');
			
		}else if(area=="orbit"){

			o = dt.orbit[value];
			if(o.altitude) html += this.buildRow(d.orbit.altitude,o.altitude);
			if(o.period) html += this.buildRow(d.orbit.period,o.period);
			if(o.obsfrac) html += this.buildRow(d.orbit.obsfrac,{'value':o.obsfrac*100,'units':'%','dimension':'percent'});
			if(o.fuellife) html += this.buildRow(d.orbit.fuellife,o.fuellife);
			if(o.temperature) html += this.buildRow(d.orbit.temperature,o.temperature);
			if(o.groundcost) html += this.buildRow(d.orbit.groundcost,o.groundcost);
			if(o.risk) html += this.buildRow(d.orbit.risk,{'value':o.risk*100,'units':'%','dimension':'percent'});

		}

		html += '<div class="clearall"></div>';
		$('#designer_'+area+' .details').html(html).addClass('padded').show();
		return this;
	}
	
	SpaceTelescope.prototype.formatScenario = function(s){
		return ''+((is(s.description,"string")) ? s.description : "").replace(/%COST%/,this.formatValueSpan(s.budget))+'';
	}

	SpaceTelescope.prototype.updateOptions = function(){
		var ph = this.phrases;

		$('#options').html('<h3>'+ph.ui.menu.options.label+'</h3><form id="optionform"><ul></ul>');

		// Loop over options
		for(var o in ph.ui.options){
		
			html = '<li><label for="change'+o+'">'+ph.ui.options[o]+'</label> <select id="change'+o+'" name="change'+o+'">';
			if(o=="currency"){
				for(var c in ph.ui[o]){
					html += '<option value="'+c+'"'+(c==this.settings.currency ? ' selected="selected"' : '')+'>'+ph.ui.currency[c].label+' '+ph.ui.currency[c].symbol+'</option>';
				}
			}else{
				for(var c in ph.ui.units){
					if(ph.ui.units[c].dimension==o && ph.ui.units[c].selectable) html += '<option value="'+c+'"'+(c==this.settings[o] ? ' selected="selected"' : '')+'>'+ph.ui.units[c].label+'</option>';
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
		if(is(key,"object")) el = key;
		else if(is(key,"string")) el = $('.'+key+'.value');

		if(el.length > 0){
			if(is(value,"object")){

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
		return (is(value,"object") ? '<span class="value'+key+' convertable" data-value="'+value.value+'" data-units="'+value.units+'" data-dimension="'+value.dimension+'">'+this.formatValue(value)+'</span>' : '<span class="value'+key+'">'+value+'</span>');
	}
	
	SpaceTelescope.prototype.copyValue = function(v){
		if(is(v,"object")) return JSON.parse(JSON.stringify(v));
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
		var ch = this.choices;
		if(choice=="mirror.cost"){
			v = (ch.mirror ? this.copyValue(this.data.mirror[ch.mirror].cost) : this.makeValue(0,'GBP'));
			v.value = -v.value;
			if(ch.deployablemirror && this.data.deployablemirror.multiplier.cost) v.value *= this.data.deployablemirror.multiplier.cost;
			if(ch.uvmirror && this.data.uvmirror.multiplier.cost) v.value *= this.data.uvmirror.multiplier.cost;
		}else if(choice=="mirror.mass"){
			v = (ch.mirror ? this.copyValue(this.data.mirror[ch.mirror].mass) : this.makeValue(0,'kg'));
			if(ch.deployablemirror && this.data.deployablemirror.multiplier.mass) v.value *= this.data.deployablemirror.multiplier.mass;
			if(ch.uvmirror && this.data.uvmirror.multiplier.mass) v.value *= this.data.uvmirror.multiplier.mass;
		}else if(choice=="mirror.time"){
			v = (ch.mirror ? this.copyValue(this.data.mirror[ch.mirror].devtime) : this.makeValue(0,'months'));
			if(ch.deployablemirror && this.data.deployablemirror.multiplier.time) v.value *= this.data.deployablemirror.multiplier.time;
			if(ch.uvmirror && this.data.uvmirror.multiplier.time) v.value *= this.data.uvmirror.multiplier.time;
		}else if(choice=="mirror.prob"){
			v = (ch.mirror ? this.data.mirror[ch.mirror].risk : 1);
			if(ch.deployablemirror && this.data.deployablemirror.risk) v *= this.data.deployablemirror.risk;
			if(ch.uvmirror && this.data.uvmirror.risk) v *= this.data.uvmirror.risk;
		}else if(choice=="mirror"){
			v = (ch.mirror) ? this.data.mirror[ch.mirror].diameter : this.makeValue(0,'m');
		}else if(choice=="cooling.cost"){
			v = (ch.cooling ? this.copyValue(ch.cooling.cost) : this.makeValue(0,'GBP'));
			v.value = -v.value;
		}else if(choice=="cooling.mass"){
			v = (ch.cooling && ch.cooling.mass ? this.copyValue(ch.cooling.mass) : this.makeValue(0,'kg'));
		}else if(choice=="cooling.passive.mass"){
			v = (ch.cooling && ch.cooling.passive ? this.copyValue(ch.cooling.passive) : this.makeValue(0,'kg'));
		}else if(choice=="cooling.active.mass"){
			v = (ch.cooling && ch.cooling.active ? this.copyValue(ch.cooling.active) : this.makeValue(0,'kg'));
		}else if(choice=="cooling.cryogenic.mass"){
			v = (ch.cooling && ch.cooling.cryogenic ? this.copyValue(ch.cooling.cryogenic) : this.makeValue(0,'kg'));
		}else if(choice=="cooling.time"){
			v = (ch.cooling ? this.copyValue(ch.cooling.time) : this.makeValue(0,'months'));
		}else if(choice=="cooling.life"){
			v = (ch.cooling && ch.cooling.life ? this.copyValue(ch.cooling.life) : this.makeValue(99,'years'));
		}else if(choice=="cooling.prob"){
			v = 1;
			if(ch.cooling && ch.cooling.risk) v = ch.cooling.risk;
		}else if(choice=="satellite.cost"){
			v = (ch.mirror ? this.copyValue(this.data.mirror[ch.mirror].bus.cost) : this.makeValue(0,'GBP'));
			if(ch.deployablemirror && this.data.deployablemirror.multiplier.bus.cost) v.value *= this.data.deployablemirror.multiplier.bus.cost;
			v.value = -v.value;
		}else if(choice=="satellite.mass"){
			v = (ch.mirror ? this.copyValue(this.data.mirror[ch.mirror].bus.mass) : this.makeValue(0,'kg'));
			if(ch.deployablemirror && this.data.deployablemirror.multiplier.bus.mass) v.value *= this.data.deployablemirror.multiplier.bus.mass;
		}else if(choice=="satellite.time"){
			v = (ch.mirror ? this.copyValue(this.data.mirror[ch.mirror].bus.devtime) : this.makeValue(0,'months'));
			if(ch.deployablemirror && this.data.deployablemirror.multiplier.bus.time) v.value *= this.data.deployablemirror.multiplier.bus.time;
		}else if(choice=="instruments.time"){
			v = (ch.instrument && ch.instrument.time) ? ch.instrument.time : this.makeValue(0,'months');
		}else if(choice=="instruments.cost"){
			v = (ch.instrument && ch.instrument.cost) ? ch.instrument.cost : this.makeValue(0,'GBP');
			v.value = -v.value;
		}else if(choice=="instruments.mass"){
			v = (ch.instrument && ch.instrument.mass) ? ch.instrument.mass : this.makeValue(0,'kg');
		}else if(choice=="instruments.prob"){
			v = (ch.instrument && ch.instrument.risk) ? ch.instrument.risk : 1;
		}else if(choice=="site"){
			v = (ch.site ? this.phrases.designer.site.options[ch.site].label : '');
		}else if(choice=="site.prob"){
			v = 0;
			if(ch.site){
				v = (this.data.site[ch.site].risk ? this.data.site[ch.site].risk : 1);
			}
		}else if(choice=="vehicle"){
			v = (ch.vehicle ? this.phrases.designer.vehicle.options[ch.vehicle].label : '');
		}else if(choice=="vehicle.cost"){
			v = (ch.vehicle ? this.copyValue(this.data.vehicle[ch.vehicle].cost) : this.makeValue(0,'GBP'));
			v.value = -v.value;		
		}else if(choice=="vehicle.prob"){
			v = 0;
			if(ch.vehicle){
				v = (this.data.vehicle[ch.vehicle].risk ? this.data.vehicle[ch.vehicle].risk : 1);
			}
		}else if(choice=="ground.cost"){
			var m = ch.mission ? this.copyValue(this.data.mission[ch.mission].life) : this.makeValue(0,'months');
			if(ch.orbit){
				v = this.copyValue(this.data.orbit[ch.orbit].groundcost);
				v.value *= -this.convertValue(m,'years').value;	
			}else{
				v = this.makeValue(0,'GBP');
			}
		}else if(choice=="temperature"){
			v = (ch.temperature) ? ch.temperature : this.makeValue(400,'K');
			if(ch.orbit) v = this.data.orbit[ch.orbit].temperature;
		}else if(choice=="launch.cost"){
			v = (ch.vehicle ? this.copyValue(this.data.vehicle[ch.vehicle].cost) : this.makeValue(0,'GBP'));
			v.value *= -(ch.orbit ? this.data.orbit[ch.orbit].multiplier.launchcost : 1);
		}else if(choice=="orbit"){
			v = (ch.orbit) ? this.phrases.designer.orbit.options[ch.orbit].label : '';
		}else if(choice=="orbit.prob"){
			v = 0;
			if(ch.orbit){
				v = (this.data.orbit[ch.orbit].risk) ? this.data.orbit[ch.orbit].risk : 1;
			}
		}else if(choice=="mission.time"){
			v = (ch.mission ? this.copyValue(this.data.mission[ch.mission].life) : this.makeValue(0,'months'));
		}else if(choice=="mission.prob"){
			v = (ch.mission && this.data.mission[ch.mission].risk ? this.data.mission[ch.mission].risk : 1);
		}else if(choice=="fuel.time"){
			v = (ch.orbit ? this.copyValue(this.data.orbit[ch.orbit].fuellife) : this.makeValue(0,'months'));
		}
		return v;
	}




	SpaceTelescope.prototype.processSummaryList = function(list,key,depth){
		depth++;
		var html = '<ul class="summary">';
		for(var i in list){
			var l = list[i];

			if(l.value || l.list){
				html += '<li>';
				if(i && l.value) html += '<span class="label '+i+'">'+l.label+'</span>'+this.formatValueSpan(l.value,key+' '+i);
				if(l.list) html += this.processSummaryList(l.list,(depth==1 ? key : ''));
				html += '</li>';
			}
		}
		html += '</ul>';
		return html;
	}
	

	SpaceTelescope.prototype.updateSummaryList = function(){
		for(var k in this.table){
			var html = '';
			var b = k;
			if(b.indexOf('_') > 0) b = b.substr(0,b.indexOf('_'));
			var keys = b;
			if(b!=k) keys += ' '+k;
			var depth = 0;
			// Update summary bar items
			if(this.table[k].value) this.updateValue('baritem .'+k,this.table[k].value);
			var output = '<h3><img src="images/cleardot.gif" class="icon '+keys+'" /> <span class="label '+keys+'">'+this.table[k].label+'</span> '+(this.table[k].value ? this.formatValueSpan(this.table[k].value,keys) : '')+'</h3>';
			if(this.table[k].list) output += this.processSummaryList(this.table[k].list,b,depth);
			$('#summaryext_'+b).addClass('padded').html(output);
		}
		return this;
	}

	// Update the summary screen based on the user's choices
	SpaceTelescope.prototype.updateSummary = function(){

		this.log('updateSummary')

		var v,fuel,cool,m,av,ok,pc,w,r,i,j,d,t,s,ph;
		var html = '';
		ph = this.phrases;
		s = ph.ui.summary;

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
		if(prob.total < 0.5 && prob.total > 0) this.warnings.push({ 'text': ph.warnings.risky });
		if(prob.total == 0) this.errors.push({ 'text': ph.errors.impossible });


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
		if(cost.free.value < 0) this.errors.push({ 'text': ph.errors.bankrupt });

		// Format times
		time.mirror = this.getChoice('mirror.time');
		time.satellite = this.getChoice('satellite.time');
		time.instruments = this.getChoice('instruments.time');
		time.cooling = this.getChoice('cooling.time');
		time.total = this.sumValues(time.mirror,time.satellite,time.cooling,time.instruments);
		time.mission = this.getChoice('mission.time');
		time.lifecooling = this.getChoice('cooling.life');
		time.fuel = this.getChoice('fuel.time');

		v = this.minValue(time.mission,time.lifecooling,time.fuel);
		v.value *= (this.choices.orbit) ? this.data.orbit[this.choices.orbit].obsfrac : 0;
		time.observing = v;

		fuel = this.convertValue(time.fuel,time.mission.units);
		if(time.mission.value > fuel.value) this.warnings.push({ 'text': ph.warnings.fuellifetime.replace(/%LIFE%/,this.formatValue(fuel)).replace(/%DURATION%/,this.formatValue(time.mission)), 'link':'#designer_orbit' });
		cool = this.convertValue(time.lifecooling,time.mission.units);
		if(time.mission.value > cool.value) this.warnings.push({ 'text': ph.warnings.coolinglifetime.replace(/%LIFE%/,this.formatValue(cool)).replace(/%DURATION%/,this.formatValue(time.mission)), 'link':'#designer_orbit' });
		
		// Warning about mission time
		if(prob.total > 0 && time.mission.value == 0) this.warnings.push({ 'text': ph.warnings.missionlife,'link':'#designer_orbit'});
	    
		// Format masses
		mass.mirror = this.getChoice('mirror.mass');
		mass.satellite = this.getChoice('satellite.mass');
		mass.cooling = this.getChoice('cooling.mass');
		mass.instruments = this.getChoice('instruments.mass');
		mass.total = this.sumValues(mass.mirror,mass.satellite,mass.cooling,mass.instruments);

		// Error about mass
		if(this.choices.orbit && this.choices.vehicle){
			m = this.convertValue((this.data.orbit[this.choices.orbit].LEO ? this.data.vehicle[this.choices.vehicle].mass.LEO : this.data.vehicle[this.choices.vehicle].mass.GTO),mass.total.units);
			if(mass.total.value > m.value) this.errors.push({ 'text': ph.errors.heavy });
			if(mass.total.value <= m.value && mass.total.value > 0.8*m.value) this.warnings.push({ 'text': ph.warnings.heavy });
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
		av = 0;
		this.table.science_total.list = {};
		if(this.scenario && this.scenario.requires && is(this.scenario.requires,"object")){ 
			var requires = this.scenario.requires;
		
			// Build mission target list
			this.table.science_total.list = {};
			for(r = 0; r < requires.length; r++){
				pc = 0;
				if(requires[r]["instruments"]){
					ok = false;
					//"instrument": "camera",
					//"wavelength": "farir"
					if(this.choices.instruments){
						for(i = 0; i < requires[r]["instruments"].length ; i++){
							ok = false;
							for(j = 0; j < this.choices.instruments.length ; j++){
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
					if(is(requires[r]["vehicle"],"object")){
						for(i = 0; i < requires[r]["vehicle"].length ; i++){
							if(this.choices.vehicle==requires[r]["vehicle"][i]) ok = true;
						}
					}else{
						if(this.choices.vehicle==requires[r]["vehicle"]) ok = true;
					}
					if(!ok) this.errors.push({ 'text': requires[r].error });
					else pc = 100;
				}
				if(requires[r]["site"]){
					w = (this.choices.vehicle) ? ph.designer.vehicle.options[this.choices.vehicle].label : '';
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
		d = new Date();
		t = this.convertValue(time.total,'months');
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

	SpaceTelescope.prototype.processFile = function(str){

		if(is(str,"string")) str = str.split(/[\n\r]/);
		var yaml,p,l,mode,my,i,s,k,v;
		yaml = false;
		mode = "";
		my = [];
		for(var i = 0; i < str.length; i++){
			p = str[i].indexOf('---');
			if(yaml && p==0) yaml = false;
			if(yaml){
				// parse
				l = str[i].split(/\:\t/);
				if(l[0]=="MODE") mode = l[1];
				else my.push({'key':l[0],'value':l[1]});
			}
			if(!yaml && p==0) yaml = true;
		}
		// We need to build callback functions here to deal with asynchonicity
		if(mode) this.setMode(mode,function(){
			function processScenario(){
				var scenario = '';
				for(i = 0; i < my.length;i++){
					if(my[i].key=="SCENARIO"){
						for(s = 0; s < this.scenarios.length; s++){
							if(this.scenarios[s].name==my[i].value) scenario = s;
						}
					}
				}
				this.chooseScenario(scenario);
				function processValues(){
					for(i = 0; i < my.length;i++){
						k = my[i].key;
						v = my[i].value;
						if(k=="MIRROR") $('#mirror_size').val(v);
						if(k=="DEPLOYABLE" && v=="true") this.changeToggle('toggledeployable','mirror_deployable_yes');
						if(k=="UVQUALITY" && v=="true") this.changeToggle('toggleuv','mirror_uv_yes');
						if(k=="VEHICLE") $('#vehicle_rocket_'+v).trigger('click');
						if(k=="SITE") $('a.'+v).trigger('click');
						if(k=="COOLING" && v=="true") this.changeToggle('hascooling','cooling_yes');
						if(k=="COOLINGACTIVE" && v=="true") this.changeToggle('cooling_active','cooling_active_yes');
						if(k=="COOLINGCRYO") $('#cooling_cryogenic').val(v);
						if(k=="COOLINGTEMP") $('#cooling_temperature').val(v);
						if(k=="DURATION") $('#mission_duration').val(v);
						if(k=="ORBIT") $('#mission_orbit').val(v).trigger('change');
						if(k.indexOf("INSTRUMENT")==0){
							var inst = v.split(/\;/);
							$('#wavelengths').val(inst[0]);
							$('#instruments').val(inst[1]);
							$('#instrument_name').val(inst[2]);
							$('.add_instrument').trigger('click');
						}
					}
				}
				this.showView('designer_objectives','',processValues);
			}
			this.showView('scenarios','',processScenario);
		});

		return this;
	}

	// Attempt to save a file
	// Blob() requires browser >= Chrome 20, Firefox 13, IE 10, Opera 12.10 or Safari 6
	SpaceTelescope.prototype.save = function(){

		// Bail out if there is no Blob function
		if(!is(Blob,"function")) return this;
		var txt,ch,t,f;

		ch = this.choices;
		t = "true";
		f = "false";

		function a(k,v){ return k+":	"+v+"\n"; }

		txt = "---\n";
		if(this.settings.mode) txt += a("MODE",this.settings.mode);
		if(this.scenario.name) txt += a("SCENARIO",this.scenario.name);
		if(ch.mirror) txt += a("MIRROR",ch.mirror);
		if(ch.deployablemirror) txt += a("DEPLOYABLE",(ch.deployablemirror ? t : f));
		if(ch.uvmirror) txt += a("UVQUALITY",(ch.uvmirror ? t : f));
		for(var i=0; i < ch.instruments.length;i++) txt += a("INSTRUMENT-"+(i+1),ch.instruments[i].wavelength+";"+ch.instruments[i].type+";"+ch.instruments[i].name);
		if(ch.cool.passive) txt += a("COOLING",(ch.cool.passive=="yes" ? t : f));
		if(ch.cool.active=="yes") txt += a("COOLINGACTIVE",(ch.cool.active=="yes" ? t : f));
		if(ch.cool.cryogenic) txt += a("COOLINGCRYO",ch.cool.cryogenic);
		if(ch.vehicle) txt += a("VEHICLE",ch.vehicle);
		if(ch.site) txt += a("SITE",ch.site);
		if(ch.mission) txt += a("DURATION",ch.mission);
		if(ch.orbit) txt += a("ORBIT",ch.orbit);
		txt += "---\n";
		var textFileAsBlob = new Blob([txt], {type:'text/plain'});
		var fileNameToSaveAs = "spacetelescope.txt";
	
		function destroyClickedElement(event){ document.body.removeChild(event.target); }

		var dl = document.createElement("a");
		dl.download = fileNameToSaveAs;
		dl.innerHTML = "Download File";
		if(window.webkitURL != null){
			// Chrome allows the link to be clicked
			// without actually adding it to the DOM.
			dl.href = window.webkitURL.createObjectURL(textFileAsBlob);
		}else{
			// Firefox requires the link to be added to the DOM
			// before it can be clicked.
			dl.href = window.URL.createObjectURL(textFileAsBlob);
			dl.onclick = destroyClickedElement;
			dl.style.display = "none";
			document.body.appendChild(dl);
		}
		dl.click();

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
			$('#launch').html('<h2>'+this.phrases.launch.title+'</h2><p>'+this.phrases.launch.intro.replace(/%DEVTIME%/,devtime).replace(/%VEHICLE%/,vehicle).replace(/%SITE%/,site).replace(/%ORBIT%/,orbit).replace(/%LAUNCHDATE%/,this.launchdate)+'</p><div id="launchanimation">'+('<div id="launchpadbg"><img src="images/launchpad_'+this.choices.site+'.png" /></div><div id="launchpadfg"><img src="images/launchpad_'+this.choices.site+'_fg.png" /></div><div id="launchrocket"><img src="'+this.data.vehicle[this.choices.vehicle].img+'" /></div>')+'<div id="countdown" class="padded">Countdown</div></div><div id="launchnav" class="toppadded"></div><ul id="launchtimeline" class="toppadded"></ul>');
	
			$('#launchanimation').css({'height':($('#launchanimation').innerWidth()/2)+'px'});

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
		var tline = $('#launchtimeline');
		var lanim = $('#launchanimation');
		var ph = this.phrases;
		var d = this.data;
		var ch = this.choices;

		function fadeIn(html){ tline.prepend($(html).hide().fadeIn(1000)); }

		if(this.ok){
			if(this.launchstep==2){
				this.ok = this.roll(prob.site*prob.vehicle);
				fadeIn('<li>'+this.buildRow(ph.launch.launch.label,(this.ok ? ph.launch.launch.success : ph.launch.launch.fail),'launch_launch')+'</li>');
				if(this.ok){
					// Rocket launched
					lanim.addClass(ch.vehicle).addClass('launched');
					this.exhaust = new Exhaust();
				}
			}else this.exhaust.stop();
			if(this.launchstep==3){
				this.ok = this.roll(prob.orbit);
				fadeIn('<li>'+this.buildRow(ph.launch.orbit.label,(this.ok ? ph.launch.orbit.success : ph.launch.orbit.fail).replace(/%ORBIT%/,this.getChoice('orbit')),'launch_orbit')+'<div id="launchorbit"></div></li>');
				if(this.ok){
					lanim.html('');
					this.launchanim = new OrbitAnimation({'id':'launchanimation','height':'50%','orbits':[ch.orbit],'phrases':ph.designer.orbit,'data':this.data.orbit,'interactive':false});
					this.launchanim.resize();
				}
			}
			if(this.launchstep==4){	
				this.ok = this.roll(prob.mirror);
				fadeIn('<li>'+this.buildRow(ph.launch.deploy.label,(this.ok ? ph.launch.deploy.success : ph.launch.deploy.fail),'launch_mirror')+'</li>');
				lanim.html('');
				this.launchanim = new Satellite({'id':'launchanimation','spacetel':this,'height':'50%','state':{'mirror':this.ok},'colourize':{'mirror':true,'bus':false,'cooling':{'passive':false,'cryogenic':false,'active':false}}});
				this.launchanim.resize();
			}
			if(this.launchstep==5){
				var okcool = true;
				var okpassive = true;
				var l = "";
				var req = this.convertValue(ch.instrument.temp,'K');
				this.launchtherm = new Thermometer({'canvas':this.launchanim.paper,'required':req.value,'phrasebook':{'req':ph.designer.instruments.temperature,'y':ph.ui.summary.profile.temperature},'context':this,'x':0,'y':0,'width':this.launchanim.paper.width*0.3,'format':this.formatValue});
				// Has the user requested cooling?
				if(ch.hascooling){
					// Do we have temperature-based cooling (normal mode)
					if(ch.cool.temperature){
						var t = this.data.cooling.temperature[$('#cooling_temperature').val()];
						if(t.temperature) this.temperature = this.copyValue(t.temperature);
						if(!t.risk) t.risk = 1;
						okcool = this.roll(t.risk);
						l += '<li>'+this.buildRow(ph.launch.cooling.label.label,(okcool ? ph.launch.cooling.label.success : ph.launch.cooling.label.fail),'launch_temperature')+'</li>';
						this.launchanim.state.cooling = { 'passive': okcool, 'active': okcool, 'cryogenic': okcool };
						this.launchanim.colourize.cooling = { 'passive': true, 'active': true, 'cryogenic': true };
						this.launchanim.build();
					}
					
					// Do we have passive cooling
					if(this.data.cooling.passive){
						l += '<li>'+this.buildRow(ph.launch.cooling.label.label,'','launch_cooling')+'</li>';
						p = ch.cool.passive;
						if(p=="yes"){
							okcool = this.roll(this.data.cooling.passive[p].risk);
							okpassive = okcool;
							if(okcool) this.temperature.value *= this.data.cooling.passive[p].multiplier.temperature;
							l += '<li class="indent">'+this.buildRow(ph.launch.cooling.passive.label,(okcool ? ph.launch.cooling.passive.success : ph.launch.cooling.passive.fail),'launch_passive')+'</li>';
							this.launchanim.state.cooling.passive = okcool;
							this.launchanim.colourize.cooling.passive = true;
							this.launchanim.build();

							// Do we have active cooling (requires passive cooling)?
							if(this.data.cooling.active && okpassive){
								p = ch.cool.active;
								if(p=="yes"){
									okcool = this.roll(this.data.cooling.active[p].risk);
									if(okcool) this.temperature.value *= this.data.cooling.active[p].multiplier.temperature;
									l += '<li class="indent">'+this.buildRow(ph.launch.cooling.active.label,(okcool ? ph.launch.cooling.active.success : ph.launch.cooling.active.fail),'launch_active')+'</li>';
									this.launchanim.state.cooling.active = okcool;
									this.launchanim.colourize.cooling.active = true;
									this.launchanim.build();
								}
							}
							// Do we have cryogenic cooling (requires passive cooling)?
							if(this.data.cooling.cryogenic && okpassive){
								p = ch.cool.cryogenic;
								if(p && p!="none"){
									okcool = this.roll(this.data.cooling.cryogenic[p].risk);
									if(okcool) this.temperature.value *= this.data.cooling.cryogenic[p].multiplier.temperature;
									l += '<li class="indent">'+this.buildRow(ph.launch.cooling.cryogenic.label,(okcool ? ph.launch.cooling.cryogenic.success : ph.launch.cooling.cryogenic.fail),'launch_cryogenic')+'</li>';
									this.launchanim.state.cooling.cryogenic = okcool;
									this.launchanim.colourize.cooling.cryogenic = true;
									this.launchanim.build();
								}
							}
						}
					}
					this.launchtherm.value(this.temperature.value);
				}
				l += '<li class="indent">'+this.buildRow(ph.launch.cooling.achieved.label,(okcool ? ph.launch.cooling.achieved.success : ph.launch.cooling.achieved.fail).replace(/\%TEMPERATURE%/,this.formatValue(this.temperature)))+'</li>';
				fadeIn(l);
			}
			if(this.launchstep==6){
				var percent = 0;
				var l = "";
				if(ch.instruments){
					l += '<li>'+this.buildRow(ph.launch.instruments.label,'')+'</li>';
					this.beakers = [];
					var dy = (this.launchanim.paper.height/(ch.instruments.length+1));
					for(var i = 0; i < ch.instruments.length; i++){
						this.beakers.push(new Flask({'canvas':this.launchanim.paper,'x':this.launchanim.paper.width*0.8,'y':(dy*(i+1) - this.launchanim.paper.width*0.04),'width':this.launchanim.paper.width*0.06,'height':this.launchanim.paper.width*0.06,'label':ch.instruments[i].name}));
						var therm = this.convertValue(this.data.wavelengths[ch.instruments[i].wavelength].temperature,this.temperature.units);
						ok = (therm.value >= this.temperature.value) ? true : false;
						ch.instruments[i].ok = ok;
						l += '<li class="indent">'+this.buildRow(ch.instruments[i].name+' ('+ph.wavelengths[ch.instruments[i].wavelength].label+' '+ph.designer.instruments.options.instrument[ch.instruments[i].type].label+')',(ok ? ph.launch.instruments.success : ph.launch.instruments.fail),'launch_instrument')+'</li>';
					}
					this.launchanim.colourize.bus = true;
					this.launchanim.build();
				}
				fadeIn(l);
			}
			if(this.launchstep==7){
				var percent = 0;
				var l = "";
				if(ch.instruments){
					l += '<li>'+this.buildRow(ph.launch.science.label,'')+'</li>';

					for(var i = 0; i < ch.instruments.length; i++){
						if(ch.instruments[i].ok){
							var t = this.copyValue(this.data.instrument.options[ch.instruments[i].type]);
							if(!t.risk) t.risk = 1;
							t.risk *= prob.mission;
							ok = this.roll(t.risk);
							var pc = 100;
							if(!ok) pc = Math.random()*100;
							percent += pc;
							this.beakers[i].value(pc/100);
							tmp = (ok ? ph.launch.science.success : ph.launch.science.fail).replace(/%PERCENT%/,this.formatValue(this.makeValue(pc,'%')));
							l += '<li class="indent">'+this.buildRow(ch.instruments[i].name+' ('+ph.wavelengths[ch.instruments[i].wavelength].label+' '+ph.designer.instruments.options.instrument[ch.instruments[i].type].label+')',tmp,'launch_science')+'</li>';
						}
					}
					if(ch.instruments.length > 0) percent /= ch.instruments.length;
				}
	
				tmp = (this.ok ? ph.launch.overall.success : ph.launch.overall.fail).replace(/\%PERCENT%/,this.formatValue(this.makeValue(percent,'%')));
				fadeIn(l);
				fadeIn('<li>'+this.buildRow(ph.launch.overall.label,tmp,'finalresult')+'</li>');
				$('.printable').remove();
				tline.after('<div class="printable toppadded"><a href="#" class="button fancybtn">'+ph.designer.proposal.reprint+'</a></div>').fadeIn();
				$('#launchnav').html('');
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

				$('#launchnav').html('<div class="relaunch toppadded"><p>'+ph.launch.relaunch.text.replace(/\%DEVTIME\%/,this.formatValue(devtime)).replace(/%RELAUNCHTIME%/,this.formatValue(relaunchtime)).replace(/%RELAUNCHCOST%/,this.formatValueSpan(cost))+'</p><a href="#" class="button fancybtn">'+ph.launch.relaunch.label+'</a></div>');
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
				if(t[i].list) t[i].list = this.setKey(t[i].list,key,typ,value);
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
		if(!is(v,"object")) return v;

		if(is(v.value,"string") && v.value != "inf") v.value = parseFloat(v.value,10);

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
				if(is(args[i],"object") && args[i].dimension && args[i].dimension===output.dimension){
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
				if(is(args[i],"object") && args[i].dimension && args[i].dimension===args[0].dimension){
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
		if(is(v,"number") && v < 1) return Math.ceil(Math.log10(1/v))+1;
		else return 1;
		return 1;
	}
		
	// Format a value differently depending on the dimension
	// Inputs:
	//  v - the value as an object e.g. { "value": 1, "units": "m", "dimension": "length" }
	//  p - the number of decimal places to show in the output (if not provided the function
	//      makes an intelligent guess).
	SpaceTelescope.prototype.formatValue = function(v,p){

		if(is(v,"string") || is(v,"number")) return v;
		if(!(is(v,"object") && v.dimension)) return "";
		ph = this.phrases;

		// Make a copy of the original so that we don't overwrite it
		v = this.copyValue(v);

		// Convert precision to a number if it is a string
		if(is(p,"string")) p = parseInt(p,10);
		var unit;
		var dim = v.dimension;

		if(dim=="length"){
			
			v = this.convertValue(v,(this.settings.length) ? this.settings.length : "m")
			if(!is(p,"number")) p = (v.units=="km" ? 0 : getPrecision(v.value));
			unit = (ph.ui.units[v.units]) ? ph.ui.units[v.units].unit : "";
			if(v.value > 1e15) return powerOfTen(v.value,unit);
			return ''+addCommas((v.value).toFixed(p)).replace(/\.0+$/,'').replace(/(\.0?[1-9]+)0+$/,"$1")+''+unit;	
			
		}else if(dim=="mass"){

			v = this.convertValue(v,(this.settings.mass) ? this.settings.mass : "kg")
			unit = (ph.ui.units[v.units]) ? ph.ui.units[v.units].unit : "";
			if(!is(p,"number")) p = (v.value >= 1000) ? 0 : getPrecision(v.value);
			if(v.value > 1e15) return powerOfTen(v.value,unit);
			else return ''+addCommas((v.value).toFixed(p)).replace(/\.0+$/,'').replace(/(\.[1-9]+)0+$/,"$1")+''+unit;
		
		}else if(dim=="currency"){
			v = this.convertValue(v,(this.settings.currency) ? this.settings.currency : "GBP")
			if(!is(p,"number")) p = 0;
	
			var append = (ph.ui.million.compact) ? ph.ui.million.compact : "";
			var s = (ph.ui.currency[v.units] && ph.ui.currency[v.units].symbol) ? ph.ui.currency[v.units].symbol : (ph.ui.currency["GBP"].symbol ? ph.ui.currency["GBP"].symbol : "");
	
			if(v.value == "inf" || v.value >= 1e15) return '&infin;';
	
			// Correct for sign of currency (we can have negative values)
			var sign = (v.value < 0) ? '-' : '';
			v.value = Math.abs(v.value);
	
			// Change the "million" to "billion" if the number if too big
			if(v.value >= 1000){
				v.value /= 1000;
				append = (ph.ui.billion.compact) ? ph.ui.billion.compact : "";
			}
			if(p == 0){
				if(v.value < 100) p = 1;
				if(v.value < 10) p = 2;
			}
			var val = (v.value).toFixed(p).replace(/\.0+$/,'').replace(/(\.[1-9]+)0+$/,"$1").replace(/^ /,"&thinsp;");
			return sign+s+val+append;

		}else if(dim=="temperature"){

			v = this.convertValue(v,(this.settings.temperature) ? this.settings.temperature : "K")
			if(is(p,"string")) p = parseInt(p,10);
			if(!is(p,"number")) p = (v.value > 1000) ? 0 : getPrecision(v.value);
			unit = (ph.ui.units[v.units]) ? ph.ui.units[v.units].unit : "";
			if(is(v.value,"string")) v.value = parseInt(v.value,10)
			return ''+addCommas((v.value).toFixed(p).replace(/\.0+$/,'').replace(/(\.[1-9])0+$/,"$1"))+''+unit;

		}else if(dim=="time"){

			if(v.units=="years" && v.value < 5) v = this.convertValue(v,"months");
			if(!is(p,"number")) p = (v.value >= 6) ? 0 : getPrecision(v.value);
			unit = (ph.ui.units[v.units]) ? ph.ui.units[v.units].unit : "";
			if(is(v.value,"string")) v.value = parseInt(v.value,10)
			return ''+addCommas((v.value).toFixed(p).replace(/\.0+$/,'').replace(/(\.[1-9])0+$/,"$1"))+''+unit;

		}else if(dim=="percent"){

			v = v.value;
			if(!is(v,"number")) v = parseInt(v,10)
			if(!is(v,"number")) return "0"+unit;
			if(!is(p,"number")) p = 1;
			unit = (ph.ui.units[v.units]) ? ph.ui.units[v.units].unit : "%";
			return ''+addCommas(v.toFixed(p)).replace(/\.0+$/,'').replace(/(\.[1-9]+)0+$/,"$1")+unit;

		}else if(dim=="angle"){

			if(v.units=="degrees" && v.value < 1) v = this.convertValue(v,"arcmin");
			if(v.units=="arcmin" && v.value < 1) v = this.convertValue(v,"arcsec");
			if(!is(p,"number")) p = (v.value >= 10) ? 0 : getPrecision(v.value);
			unit = (ph.ui.units[v.units]) ? ph.ui.units[v.units].unit : "";
			if(is(v.value,"string")) v.value = parseInt(v.value,10);
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
		if(!is(v,"number")) v = 0;
		if(!is(p,"number")) p = 1;
		return ''+addCommas((v*100).toFixed(p)).replace(/\.0+$/,'').replace(/(\.[1-9]+)0+$/,"$1")+'%';
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

		var l,m,u,c,t,v,s,p,o,ok,cost,mass,temp,time,risk,deploy;

		this.errors = [];
		this.warnings = [];
		
		var ch = this.choices;
		var d = this.data;
		
		// Get mission
		l = $('#mission_duration').val();
		ch.mission = (l && d.mission[l]) ? l : "";

		// Get satellite
		m = $('#mirror_size').val();

		ch.mirror = (m && d.mirror[m]) ? m : "";
		deploy = $('input[name=toggledeployable]:checked').val();
		ch.deployablemirror = (deploy && deploy=="yes") ? true : false;

		u = $('input[name=toggleuv]:checked').val();
		ch.uvmirror = (u && u=="yes") ? true : false;

		// Get vehicle
		v = $('#designer_vehicle input[name=vehicle_rocket]:checked').val();
		ch.vehicle = (v && d.vehicle[v]) ? v : "";

		// Get site
		s = $('#site').val();
		ok = false;
		ch.site = (s && d.site[s]) ? s : "";

		// Get orbit
		o = $('#mission_orbit').val();
		if(o && d.orbit[o]) ch.orbit = o;
		else ch.orbit = "";

		// Get cooling
		c = $('input[name=hascooling]:checked').val();
		ch.hascooling = (c && c=="yes") ? true : false;
		ch.cool = {};
		t = $('#cooling_temperature').val();
		ch.cool.temperature = (t) ? t : "";
		ch.cool.passive = this.getValue('input[name=cooling_passive]:checked');
		ch.cool.active = this.getValue('input[name=cooling_active]:checked');
		ch.cool.cryogenic = $('#cooling_cryogenic').val();
		// Set a maximum temperature
		ch.temperature = this.makeValue(400,'K');

		// Process instruments
		ch.instrument = {
			"cost": this.makeValue(0,'GBP'),
			"mass": this.makeValue(0,'kg'),
			"temp": this.makeValue(400,'K'),
			"time": this.makeValue(0,'months'),
			"risk": 1
		}
		if(ch.instruments){
			var uv = false;
			for(var i = 0; i < ch.instruments.length; i++){
				var t = this.copyValue(d.instrument.options[ch.instruments[i].type]);
				if(!t.multiplier) t.multiplier = { };
				if(!t.multiplier.cost) t.multiplier.cost = 1;
				if(!t.multiplier.mass) t.multiplier.mass = 1;

				var w = this.copyValue(d.wavelengths[ch.instruments[i].wavelength]);
				if(w.cost) w.cost.value *= t.multiplier.cost;
				ch.instrument.cost = this.sumValues(ch.instrument.cost,w.cost);
				if(w.mass) ch.instrument.mass = this.sumValues(ch.instrument.mass,w.mass);
				ch.instrument.mass.value *= t.multiplier.mass;
				ch.instrument.temp = this.minValue(ch.instrument.temp,w.temperature);
				if(t.devtime) ch.instrument.time = this.sumValues(ch.instrument.time,t.devtime);
				if(t.risk) ch.instrument.risk *= t.risk;
				if(ch.instruments[i].wavelength=="uv") uv = true;
			}

			var slots = (ch.mirror) ? d.mirror[ch.mirror].bus.instrumentslots : 0;
			if(ch.instruments.length > slots) this.errors.push({ 'text': this.phrases.errors.slots, 'link': '#designer_instruments' });
			if(!ch.uvmirror && uv)  this.errors.push({ 'text': this.phrases.errors.uv, 'link': '#designer_satellite' });

		}

		// Process site
		if(ch.site){
			if(ch.vehicle){
				// See if the chosen vehicle can launch from this site
				for(var i = 0; i < d.vehicle[ch.vehicle].sites.length; i++){
					if(d.vehicle[ch.vehicle].sites[i] == s) ok = true;
				}
			}else{
				// No vehicle chosen so the site is actually OK
				ok = true;
			}
			if(!ok) this.errors.push({ 'text': this.phrases.errors.site.replace(/%SITE%/g,this.phrases.designer.site.options[s].label).replace(/%VEHICLE%/,this.phrases.designer.vehicle.options[v].label), 'link': '#designer_site' });
		}

		// If we have a vehicle and a mirror we work out if the satellite can fit
		if(ch.vehicle && ch.mirror){
			var fairing = this.copyValue(d.vehicle[ch.vehicle].diameter);
			var sylda = this.copyValue(d.mirror[ch.mirror].bus.diameter);
			if(ch.deployablemirror && d.deployablemirror.multiplier.bus.diameter) sylda.value *= d.deployablemirror.multiplier.bus.diameter;
			if(sylda.value > fairing.value) this.errors.push({ 'text': this.phrases.errors.size, 'link': '#designer_satellite' });
		}

		// Process orbit
		if(ch.orbit){
			ok = false;
			if(ch.site){
				ok = d.site[ch.site].orbits[o];
			}else{
				// No site chosen so the site is actually OK
				ok = true;
			}
			if(!ok) this.errors.push({ 'text': this.phrases.errors.orbit.replace(/%SITE%/g,this.phrases.designer.site.options[s].label).replace(/%ORBIT%/,this.phrases.designer.orbit.options[o].label), 'link': '#designer_orbit' });

			// Set temperature from orbit
			ch.temperature = this.copyValue(d.orbit[ch.orbit].temperature);
		}

		// Process cooling
		ch.cooling = {
			"cost": this.makeValue(0,'GBP'),
			"mass": this.makeValue(0,'kg'),
			"life": this.makeValue(99,'years'),
			"time": this.makeValue(0,'months'),
			"risk": 1
		}
		// Has the user requested cooling?
		if(ch.hascooling){
			// Do we have temperature-based cooling (normal mode)
			if(ch.cool.temperature){
				t = d.cooling.temperature[$('#cooling_temperature').val()];
				if(t.temperature) ch.temperature = this.copyValue(t.temperature);
				if(t.mass) ch.cooling.mass = this.sumValues(ch.cooling.mass,t.mass);
				if(t.cost) ch.cooling.cost = this.sumValues(ch.cooling.cost,t.cost);
				if(t.devtime) ch.cooling.time = this.sumValues(ch.cooling.time,t.devtime);
				if(t.life) ch.cooling.life = this.minValue(ch.cooling.life,t.life);
				if(t.risk) ch.cooling.risk *= t.risk;
				if(ch.mirror && d.mirror[m]['passive']){
					ch.cooling.mass = this.sumValues(ch.cooling.mass,d.mirror[m]['passive'].mass);
					ch.cooling.cost = this.sumValues(ch.cooling.cost,d.mirror[m]['passive'].cost);
					ch.cooling.time = this.sumValues(ch.cooling.time,d.mirror[m]['passive'].devtime);
				}
			}

			// Do we have passive cooling
			if(d.cooling.passive){
				p = ch.cool.passive;
				if(p=="yes"){
					ch.cooling.time = this.sumValues(ch.cooling.time,d.cooling.passive[p].devtime);
					if(ch.mirror && d.mirror[ch.mirror].passive){
						ch.cooling.mass = this.sumValues(ch.cooling.mass,d.mirror[ch.mirror].passive.mass);
						ch.cooling.passive = d.mirror[ch.mirror].passive.mass;
						ch.cooling.cost = this.sumValues(ch.cooling.cost,d.mirror[ch.mirror].passive.cost);
					}
					ch.cooling.mass.value *= d.cooling.passive[p].multiplier.mass;
					ch.cooling.cost.value *= d.cooling.passive[p].multiplier.cost;
					ch.cooling.risk *= d.cooling.passive[p].risk;
					ch.temperature.value *= d.cooling.passive[p].multiplier.temperature;
					if(d.cooling.passive[p].life) ch.cooling.life = this.minValue(ch.cooling.life,d.cooling.passive[p].life);
					if(ch.orbit){
						ch.cooling.life.value *= d.orbit[ch.orbit].multiplier.passive.time;
						if(d.orbit[ch.orbit].multiplier.cryo.time==0) this.errors.push({ 'text': this.phrases.errors.hotorbitpassive, 'link': '#designer_orbit' });
					}
					// Do we have active cooling (requires passive cooling)?
					if(d.cooling.active){
						p = ch.cool.active;
						if(p=="yes"){
							ch.cooling.time = this.sumValues(ch.cooling.time,d.cooling.active[p].devtime);
							ch.cooling.cost = this.sumValues(ch.cooling.cost,d.cooling.active[p].cost);
							ch.cooling.mass = this.sumValues(ch.cooling.mass,d.cooling.active[p].mass);
							ch.cooling.active = d.cooling.active[p].mass;
							ch.cooling.risk *= d.cooling.active[p].risk;
							ch.temperature.value *= d.cooling.active[p].multiplier.temperature;
							if(d.cooling.active[p].life) ch.cooling.life = this.minValue(ch.cooling.life,d.cooling.active[p].life);
						}
					}
					ch.cooling.cryogeniclife = 0;
					// Do we have cryogenic cooling (requires passive cooling)?
					if(d.cooling.cryogenic){
						p = ch.cool.cryogenic;
						if(p && p!="none"){
							ch.cooling.time = this.sumValues(ch.cooling.time,d.cooling.cryogenic[p].devtime);
							ch.cooling.cost = this.sumValues(ch.cooling.cost,d.cooling.cryogenic[p].cost);
							ch.cooling.mass = this.sumValues(ch.cooling.mass,d.cooling.cryogenic[p].mass);
							ch.cooling.cryogenic = d.cooling.cryogenic[p].mass;
							ch.cooling.risk *= d.cooling.cryogenic[p].risk;
							ch.temperature.value *= d.cooling.cryogenic[p].multiplier.temperature;
							if(d.cooling.cryogenic[p].life){
								ch.cooling.life = this.minValue(ch.cooling.life,d.cooling.cryogenic[p].life);
								ch.cooling.cyrogeniclife = this.convertValue(d.cooling.cryogenic[p].life,"years");
								ch.cooling.cyrogeniclife = ch.cooling.cyrogeniclife.value;
							}
							if(ch.orbit){
								ch.cooling.life.value *= d.orbit[ch.orbit].multiplier.cryo.time;
								var mt = d.orbit[ch.orbit].multiplier.cryo.time;
								if(mt==0) this.errors.push({ 'text': this.phrases.errors.hotorbitcryo, 'link': '#designer_orbit' });
								if(mt < 1 && mt > 0) this.warnings.push({ 'text': this.phrases.warnings.warmorbitcryo, 'link': '#designer_orbit' });
							}
						}
					}
				}else{
					// Warnings if the user has requested active or cryogenic cooling but no passive cooling selected
					if(d.cooling.active && this.getValue('input[name=cooling_active]:checked')=="yes" && p=="no") this.warnings.push({ 'text': this.phrases.warnings.activenopassive, 'link': '#designer_cooling' });
					if(d.cooling.cryogenic && this.getValue('#cooling_cryogenic')!="none" && p=="no") this.warnings.push({ 'text': this.phrases.warnings.cryonopassive, 'link': '#designer_cooling' });
				}
			}
		}

		// Error if the temperature achieved is not suitable for the instruments 
		var a = this.convertValue(ch.instrument.temp,'K');
		var b = this.convertValue(ch.temperature,'K');
		if(b.value > a.value) this.errors.push({ 'text': this.phrases.errors.temperature.replace(/%TEMPERATURE%/,'<strong>'+this.formatValue(b)+'</strong>').replace(/%REQUIREMENT%/,'<strong>'+this.formatValue(a)+'</strong>'), 'link': '#designer_cooling' });

		if(this.proposalCompleteness() < 1) this.warnings.push({ 'text': this.phrases.warnings.proposal, 'link': '#designer_proposal' })

		this.choices = ch;	// Update the choices

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

	SpaceTelescope.prototype.showView = function(view,e,fn){

		this.log('showView',view,e)

		if(is(view,"object")){
			e = view;
			view = '';
		}

		if(!is(view,"string")) view = "";

		// Don't do anything for certain views
		if(view=="messages" || view=="menu" || view=="language" || view=="options" || view.indexOf("summaryext")==0){
			if(e && is(e,"object") && is(e.preventDefault,"function")) e.preventDefault();
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
				if(section=="orbit") this.makeSpace('orbits').displayOrbits();
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

		if(is(fn,"function")) fn.call(this);
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
		if(is(key,"object")){
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
		if(is(key,"string")){
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
					if(k != "title" && k != "about" && is(this.phrases.guide[k].title,"string")){
						html += '<li><a href="#guide_'+k+'" class="guidelink">'+this.phrases.guide[k].title+'</a><br />'+(is(this.phrases.guide[k].summary,"string") ? this.phrases.guide[k].summary : "")+'</li>';
					}
				}
				html += '</ul>'
			
			}else if(g[key]){

				html += '<div class="guidetop"><span class="breadcrumb"><a href="#guide" class="guidelink">'+g.title+'</a> &raquo; '+g[key].title+'</span></div>'
	
				txt = g[key].about;
				var m = this.data.mirror;
				if(key=="mirror"){
					table = '';
					for(i in m){
						table += '<tr>';
						table += '<td>'+this.formatValue(m[i].diameter)+'</td>';
						table += '<td>'+this.formatValue(m[i].mass)+'</td>';
						table += '<td>'+this.formatValue(m[i].cost)+'</td>';
						if(this.settings.mode=="advanced") table += '<td>'+this.formatValue(m[i].devtime)+'</td>';
						table += '</tr>';
					}
					txt = txt.replace(/\%MIRRORTABLE\%/,table);
				}else if(key=="structure"){
					table = '';
					for(i in m){
						table += '<tr>';
						table += '<td>'+this.formatValue(m[i].diameter)+'</td>';
						table += '<td>'+this.formatValue(m[i].bus.diameter)+'</td>';
						table += '<td>'+this.formatValue(m[i].bus.cost)+'</td>';
						table += '<td>'+this.formatValue(m[i].bus.mass)+'</td>';
						table += '</tr>';
					}
					txt = txt.replace(/\%STRUCTURETABLE\%/,table);
				}else if(key=="cooling"){
					table = '';
					var c = this.data.cooling;
					if(this.settings.mode=="advanced"){
						for(i in c.cryogenic){
							if(i != "none"){
								table += '<tr>';
								table += '<td>'+this.formatValue(c.cryogenic[i].life)+'</td>';
								table += '<td>'+this.formatValue(c.cryogenic[i].cost)+'</td>';
								table += '<td>'+this.formatValue(c.cryogenic[i].mass)+'</td>';
								table += '</tr>';
							}
						}
						txt = txt.replace(/\%ACTIVELIFE\%/,this.formatValue(c.active.yes.life));
						txt = txt.replace(/\%ACTIVEMASS\%/,this.formatValue(c.active.yes.mass));
						txt = txt.replace(/\%ACTIVECOST\%/,this.formatValue(c.active.yes.cost));
	
					}else{
						for(i in c.temperature){
							table += '<tr>';
							table += '<td>'+this.formatValue(c.temperature[i].temperature)+'</td>';
							table += '<td>'+this.formatValue(c.temperature[i].cost)+'</td>';
							table += '<td>'+this.formatValue(c.temperature[i].mass)+'</td>';
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
						if(k != "title" && k != "about" && is(g[key][k].title,"string")){
							html += '<h3>'+g[key][k].title+'</h3><p>'+g[key][k].about+'</p>';
						}
					}
				}else if(key=="previous"){
					for(k in g[key]["missions"]){
						if(is(g[key]["missions"][k].title,"string")){
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

			if(html.indexOf('script')>= 0 && is(MathJax,"object")) MathJax.Hub.Queue(["Typeset",MathJax.Hub,'guide']);

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

	// Log messages
	SpaceTelescope.prototype.log = function(){
		var args = Array.prototype.slice.call(arguments, 0);
		if(console && is(console.log,"function")) console.log('LOG',args);
		return this;
	}

	// Class for drawing the satellite
	// Inputs:
	//   inp.id        = (string) ID of an HTML element to attach the animation to
	//   inp.height    = (string) e.g. 50%
	//   inp.spacetel  = (object) The context for the SpaceTelescope class
	//   inp.colourize = (object) Do we add colour to the different components?
	//   inp.state     = (object) Are the components working?
	function Satellite(inp){

		if(!inp) inp = {};
		if(inp.spacetel) this.s = inp.spacetel;
		else return this;
		
		this.heightscale = "";	// Do we scale the height?
		this.prop = { 'mirror': 0, 'bus': 0, 'slots': 0 };
		
		this.id = (is(inp.id,"string")) ? inp.id : "sidebar_satellite";
		if(!this.el) this.el = $('#'+this.id);
		if(this.el.find('#'+this.id+'_schematic').length==0) this.el.html('<div class="schematic" id="'+this.id+'_schematic"></div>')
		if(is(inp.height,"string") && inp.height.indexOf('%') > 0) this.heightscale = parseFloat(inp.height)/100;

		// Are the components working?
		this.state = { 'cooling': { 'passive': true, 'active': true, 'cryogenic': true }, 'mirror': true, 'bus': true };
		if(is(inp.state,"object")){ for(var i in inp.state) this.state[i] = inp.state[i]; }

		// Do we add colour to the components? If we do but their state is false, they go black
		this.colourize = { 'cooling': { 'passive': false, 'active': false, 'cryogenic': true }, 'mirror': false, 'bus': true };
		if(is(inp.colourize,"object")){ for(var i in inp.colourize) this.colourize[i] = inp.colourize[i]; }

		// Add resize function
		$(window).on('resize',{me:this},function(e){ e.data.me.resize(); });

		return this;
	}

	Satellite.prototype.getScales = function(px,padd){
		var f = Math.floor(px/32);	// scale factor
		var fb = f*(this.prop.bus/this.prop.mirror);	// scale factor for bus width
		var bodyh = 8;	// height of satellite body in units of f
		var insth = 2;   // The height of the instruments
		var hbus = 10*fb;
		// Work out size of cryogenic tank based on the cryo-life
		var tank = (this.s.choices.cooling.cryogenic ? this.s.choices.cooling.cyrogeniclife : 0);
		// If we've not set the tank size and we're in basic mode we'll draw a tank if the set temperatue is low enough
		if(tank==0 && this.s.choices.cool.temperature){
			var t = this.s.convertValue(this.s.choices.temperature,'K');
			// Scale the tank based on the temperature acheived
			if(t.value < 50) tank = Math.log(50/t.value);
		}
		var bodytop = 4; // The height of the neck at the top of the dewar
		var hbody = ((bodyh+bodytop+tank)*f);	// The height of the dewar
		var hmirror = 13*f;	// The height of the mirror
		var hvgroove = (this.s.choices.cooling.passive ? 2*f : 0); // The height of the vgrooves
		if(this.s.choices.cool.temperature){
			var t = this.s.convertValue(this.s.choices.temperature,'K');
			if(t.value < 300) hvgroove = 2*f;
		}
		h = (this.s.choices.mirror) ? hbus+hbody+hmirror+hvgroove+(2*padd) : 0;
		return {'body':hbody,'vgroove':hvgroove,'bus':hbus,'mirror':hmirror,'h':h,'fb':fb,'f':f,'top':bodytop,'bodyh':bodyh,'tank':tank,'instrument':insth};
	}

	Satellite.prototype.build = function(){

		var h = 160;
		var w = this.el.parent().innerWidth();
		var d;

		var c = Math.cos(Math.PI*30/180);
		if(this.s.choices.mirror){
			for(var m in this.s.data.mirror){
				d = this.s.convertValue(this.s.data.mirror[m].diameter,'m');
				if(m==this.s.choices.mirror) this.prop.mirror = d.value;
			}
			for(var m in this.s.data.mirror){
				d = this.s.convertValue(this.s.data.mirror[m].bus.diameter,'m');
				if(m==this.s.choices.mirror){
					this.prop.bus = d.value;
					if(this.s.choices.deployablemirror && this.s.data.deployablemirror.multiplier.bus.diameter) this.prop.bus *= this.s.data.deployablemirror.multiplier.bus.diameter;
					this.prop.slots = this.s.data.mirror[m].bus.instrumentslots;
				}
			}
		}

		var padd = 16;	// padding in pixels
		var ht;
		if(this.heightscale){
			ht = this.getScales(200,padd); // If we had a 100px wide box we find out how big the satellite would be
			w = (w*this.heightscale)*200/ht.h;	// Update the width
		}
		ht = this.getScales(w,padd);
		var fb = ht.fb;
		var f = ht.f;
		var bodyh = ht.bodyh;
		var tank = ht.tank;
		var bodytop = ht.top;
		var insth = ht.instrument;

		h = (this.s.choices.mirror) ? ht.bus+ht.body+ht.mirror+ht.vgroove+(2*padd) : 0;

		// Create the canvas for this
		if(this.heightscale) this.create(w,w*this.heightscale);
		else this.create("auto",h)

		if(this.bus){
			this.bus.remove();
			delete this.bus;
		}
		if(this.body){
			this.body.remove();
			delete this.body;
		}
		if(this.vgroove){
			this.vgroove.remove();
			delete this.vgroove;
		}
		if(this.mirror){
			this.mirror.remove();
			delete this.mirror;
		}

		// Define some styles
		var solid = {'stroke':'white','stroke-width':1,'fill':'white','fill-opacity':0.5};		
		var solidlight = {'stroke':'white','stroke-width':1,'fill':'white','fill-opacity':0.15};		
		var stroke = {'stroke':'white','stroke-width':1};
		var colour,style;
		var p = this.paper;

		if(this.s.choices.mirror){
			this.bus = p.set();
			// Solar shield
			this.bus.push(p.ellipse(0,3.5*fb,10*fb,6*fb).attr(solid));
			// Top of bus
			this.bus.push(p.path('m '+(-8.5*fb)+', '+(-2*fb)+' l0,'+(4*fb)+' l'+(5*fb)+','+(3*fb)+' l'+(7*fb)+',0 l'+(5*fb)+','+(-3*fb)+' l0,'+(-4*fb)+' l'+(-5*fb)+','+(-3*fb)+' l'+(-7*fb)+',0 z').attr(solid));
			// Bus sides
			this.bus.push(p.path('m '+(-8.5*fb)+', '+(2*fb)+' l0,'+(3.5*fb)+' l'+(5*fb)+','+(3*fb)+' l0,'+(-3.5*fb)+' z').attr(solid));
			this.bus.push(p.path('m '+(-3.5*fb)+', '+(5*fb)+' l'+(7*fb)+',0 l0,'+(3.5*fb)+' l'+(-7*fb)+',0 z').attr(solid));
			this.bus.push(p.path('m '+(8.5*fb)+', '+(2*fb)+' l0,'+(3.5*fb)+' l'+(-5*fb)+','+(3*fb)+' l0,'+(-3.5*fb)+' z').attr(solid));
		}

		if(ht.vgroove > 0){
			style = {'stroke':'white','stroke-width':1,'fill':'white','fill-opacity':0.15};
			// If we are in-flight and the the cooling state has been explicitly set to false we change the colour
			if(this.colourize.cooling.passive){ style.fill = (this.state.cooling.passive) ? $('.mass').css('color') : "black"; style['fill-opacity'] = 0.5; }
			this.vgroove = p.set();
			this.vgroove.push(p.ellipse(0,-0.6*fb,8.5*fb,5*fb).attr(style));
			this.vgroove.push(p.ellipse(0,-1.2*fb,8.25*fb,4.75*fb).attr(style));
			this.vgroove.push(p.ellipse(0,-1.8*fb,8*fb,4.5*fb).attr(style));
			this.vgroove.push(p.path('m 0,'+(-0.6*fb)+' l'+(-5.5*fb)+','+(2.5*fb)+' m'+(5.5*fb)+','+(-2.5*fb)+' l'+(1.5*fb)+','+(3.5*fb)+' m'+(-1.5*fb)+','+(-3.5*fb)+' l'+(8*fb)+','+(-fb)+' m'+(-8*fb)+','+(fb)+' l'+(5*fb)+','+(-5*fb)+' m'+(-5*fb)+','+(5*fb)+' l'+(-2*fb)+','+(-5.5*fb)+' m'+(2*fb)+','+(5.5*fb)+' l'+(-7*fb)+','+(-3*fb)).attr({'stroke':'white','stroke-width':1,'stroke-opacity':0.4}))
		}
		
		if(this.s.choices.mirror){
			this.body = p.set();
			var bw = Math.min(7,8.5*(this.prop.bus/this.prop.mirror));
			var bt = bw*0.4;
			var bh = (bw-bt);
			// Base circle for body
			this.body.push(p.ellipse(0,0,bw*f,bh*f).attr(stroke));
			// Shape of body
			this.body.push(p.path('m '+(-bw*f)+',0 a '+(bw*f)+','+(bh*f)+' 0 0,0 '+(2*bw*f)+',0 l 0,'+(-(bodyh+tank-1)*f)+' q 0,'+(-2*f)+' '+(-bh*f)+','+(-bodytop*f)+' l0,'+(-1*f)+' a'+(bt*f)+','+(bt*0.5*f)+' 0 0,0 '+(-2*bt*f)+',0 l0,'+(1*f)+' q'+(-bh*f)+','+(1*f)+' '+(-bh*f)+','+(bh*f)+' z').attr(solid));
			if(tank > 0){
				// Tank 
				style = {'stroke':'white','stroke-width':1,'fill':'white','fill-opacity':0.3};
				// If we are in-flight and the the cooling state has been explicitly set to false we change the colour
				if(this.colourize.cooling.cryogenic){ style.fill = (this.state.cooling.cryogenic) ? $('.mass').css('color') : "black"; style['fill-opacity'] = 0.8; }
				this.body.push(p.path('m '+(-bw*f)+',0 a '+(bw*f)+','+(bh*f)+' 0 0,0 '+(2*bw*f)+',0 l 0,'+(-tank*f)+' a '+(bw*f)+','+(bh*f)+' 0 0,0 '+(-2*bw*f)+',0 z').attr(style));
				this.body.push(p.ellipse(0,(-tank*f),bw*f,bh*f).attr(stroke));
			}
			// Top circle
			this.body.push(p.ellipse(0,(-(bodyh+tank+bodytop)*f),bt*f,bt*0.5*f).attr(stroke));

			// Build instrument slots
			var cols = Math.ceil(this.prop.slots/2);	// How many columns of instruments do we have?
			var x,y,xl,yl;
			var instw = 2.2; // The width of the instrument
			instw = bw*2/(cols+2)
			var i2 = instw/2; // Half the width
			var i4 = instw/4; // Quarter the width

			// Get the number of instruments
			var n = 0;
			var ni = (this.s.choices.instruments) ? this.s.choices.instruments.length : 0;
			
			// Remove existing labels
			$('#'+this.id+'_schematic .label').remove();
			var html = "";

			w = this.el.innerWidth();
			h = this.el.innerHeight()
			// Loop over instruments
			for(var i = 0 ; i < cols; i++){
				x = (i-(cols-1)/2)*(instw*f*1.25);
				for(var j = 0; j < 2; j++){
					y = tank + 1.5 + (j==0 ? 0 : insth*2);
					xl = 0.5 + (x+(j==0 ? i4*f : 0))/w;
					yl = (padd+(ht.bus+ht.vgroove+(y+(j==0 ? -insth : +insth*1.5))*f))/h;
					if(n < ni){
						// Use the 'science' colour
						style = {'stroke':'white','stroke-width':1,'fill':'white','fill-opacity': 0.3 };
						if(this.colourize.bus){
							style['fill-opacity'] = 1;
							if(this.state.bus) style['fill'] = $('.science').css('color');
							if(!this.s.choices.instruments[n].ok) style.fill = 'black';
						}
					}else{
						style = {'stroke':'white','stroke-width':1,'stroke-dasharray':'- ','fill':'white','fill-opacity':0.2};
					}
					this.body.push(p.path('m'+(x-i2*f)+','+(-y*f)+' l'+(i2*f)+','+(i4*f)+' l'+(i2*f)+','+(-i4*f)+' l0,'+(-insth*f)+' l'+(-i2*f)+','+(-i4*f)+' l'+(-i2*f)+','+(i4*f)+' z m'+(i2*f)+','+(i4*f)+' l0,'+(-insth*f)+' l'+(-i2*f)+','+(-i4*f)+'m'+(i2*f)+','+(i4*f)+'l'+(i2*f)+','+(-i4*f)).attr(style));
					// Add a label if we can apply a CSS3 transform
					if(n < ni && this.s.choices.instruments[n] && this.s.hastransform) html += '<div class="label '+(j==0 ? 'bottom':'top')+'" style="bottom:'+(100*yl)+'%; left:'+(100*xl)+'%">'+this.s.choices.instruments[n].name+'</div>';
					n++;
				}
			}
			if(html) $('#'+this.id+'_schematic').prepend(html);
		}

		if(this.s.choices.mirror){
			style = {'stroke':'white','stroke-width':1,'fill':'white','fill-opacity':0.5};
			// If the mirror state is true we use colour
			if(this.colourize.mirror){
				style.fill = $('.time').css('color');
				if(!this.state.mirror){
					style.fill = 'black';
					style['stroke'] = '#ff0000';
				}
			}

			this.mirror = p.set();
			// Primary mirror
			this.mirror.push(p.ellipse(0,-2.5*f,10*f,6*f).attr(style));
			// Hole in primary mirror
			this.mirror.push(p.ellipse(0,0,1*f,0.6*f).attr(solid));
			// Draw back struts
			this.mirror.push(p.path('m '+(-2*f)+','+(-11*f)+' l'+(-3*f)+','+(6*f)+' l '+(5*f)+','+(-7*f)+' l'+(5*f)+','+(7*f)+' l'+(-3*f)+','+(-6*f)).attr(stroke));
			// Draw front struts
			this.mirror.push(p.path('m '+(-2*f)+','+(-11*f)+' l'+(2*f)+','+(-1*f)+' l 0,'+(-1*f)+' l'+(-2*f)+','+(1*f)+' z').attr(solid));
			// Draw back secondary mirror structure
			this.mirror.push(p.path('m '+(2*f)+','+(-11*f)+' l'+(-2*f)+','+(-1*f)+' l 0,'+(-1*f)+' l'+(2*f)+','+(1*f)+' z').attr(solid));
			this.mirror.push(p.path('m '+(-2*f)+','+(-11*f)+' l'+(-4*f)+','+(12*f)+' l '+(6*f)+','+(-11*f)+' l'+(6*f)+','+(11*f)+' l'+(-4*f)+','+(-12*f)).attr(stroke));
			// Draw secondary mirror
			this.mirror.push(p.ellipse(0,(-11*f),2*f,1*f).attr(style));
			// Draw front of secondary mirror structure
			this.mirror.push(p.path('m '+(-2*f)+','+(-12*f)+' l'+(2*f)+','+(1*f)+' l 0,'+(1*f)+' l'+(-2*f)+','+(-1*f)+' z').attr(solid));
			this.mirror.push(p.path('m '+(2*f)+','+(-12*f)+' l'+(-2*f)+','+(1*f)+' l 0,'+(1*f)+' l'+(2*f)+','+(-1*f)+' z').attr(solid));
		}

		// Move bus
		if(this.bus) for(var i = 0; i < this.bus.length; i++) transformer(this.bus[i],['t',this.width/2,h - padd - ht.bus]);
		// Move vgroove
		if(this.vgroove) for(var i = 0; i < this.vgroove.length; i++) transformer(this.vgroove[i],['t',this.width/2,h - padd -ht.bus]);
		// Move body
		if(this.body) for(var i = 0; i < this.body.length; i++) transformer(this.body[i],['t',this.width/2,h - padd - ht.bus - ht.vgroove]);
		// Move mirror
		if(this.mirror) for(var i = 0; i < this.mirror.length; i++) transformer(this.mirror[i],['t',this.width/2,h - padd -ht.bus - ht.vgroove - ht.body]);

		return this;

	}

	Satellite.prototype.resize = function(w,h){
		this.build();
		return this;
	}

	Satellite.prototype.create = function(w,h){

		// Hide the contents so we can calculate the size of the container
		$('#'+this.id+'_schematic').hide();

		// Make the element fill the container's width
		this.el.css({'width':'auto','display':'block'});

		// Get the inner width of the space container (i.e. without margins)
		if(!w || w=="auto") w = this.el.innerWidth();
		var s = this.el.parent();
		if(w < s.width()/2) w = s.width()-(parseInt(this.el.css('margin-left'),10) + parseInt(this.el.css('margin-right'),10));
		if(!h) h = w/2;
		if(this.heightscale) h = w*this.heightscale;

		// Check if the HTML element has changed size due to responsive CSS
		if(w != this.width || h != this.height || this.width==0){
			this.width = w;
			if(this.width == 0) this.width = s.width()-(parseInt(this.el.css('margin-left'),10) + parseInt(this.el.css('margin-right'),10));
			this.height = h;

			// Create the Raphael object to hold the vector graphics
			if(!this.paper){
				this.paper = Raphael(this.id+'_schematic', this.width, this.height);
			}else{
				this.paper.setSize(this.width,this.height);
				this.rebuild = true;
			}
		}

		// Show the contents again
		$('#'+this.id+'_schematic').show();

		return this;	
	}


	// Class for creating an orbit animation
	// Inputs:
	//   inp.id       = (string) ID of an HTML element to attach the animation to
	//   inp.zoom     = (number) The zoom level
	//   inp.data     = (object) The data relevant to the orbits
	//   inp.phrases  = (object) The phrasebook relevant to orbits
	//   inp.callback = (function) A function to call when an orbit is clicked
	//   inp.context  = (object) The context to use for the callback function
	//   inp.interactive = (boolean) Is this interactive?
	//   inp.orbits   = (array) An array of keys for which orbits to use
	function OrbitAnimation(inp){
	
		this.width = 0;	// The width
		this.height = 300;	// The height
		this.heightscale = "";
		this.zoom = 0;	// The zoom level
		this.scale = [1,0.022];	// The scale of space for the different zoom levels
		this.anim = {};
		this.orbits = {};	// The properties of the orbits
		this.labels = {};	// The labels
		this.svg = { 'orbits': {} };
		this.phrases = {};
		this.data = {};
		this.callback;
		this.spacetel = {};
		this.id = "orbits";
		this.interactive = true;
		
		if(!inp) inp = {};
		if(is(inp.id,"string")) this.id = inp.id;
		if(is(inp.zoom,"number")) this.zoom = inp.zoom;
		this.el = $('#'+this.id);
		if(is(inp.phrases,"object")) this.phrases = inp.phrases;
		if(is(inp.data,"object")) this.data = inp.data;
		if(is(inp.callback,"function")) this.callback = inp.callback;
		if(is(inp.interactive,"boolean")) this.interactive = inp.interactive;
		if(is(inp.height,"string") && inp.height.indexOf('%') > 0) this.heightscale = inp.height/100;
		if(is(inp.height,"number")) this.height = inp.height;
		if(inp.context) this.spacetel = inp.context;
		
		// Properties for the orbit animation
		this.orbits = {
			"GEO": { "i": 0, "color": "#048b9f", "e": 0.3, "zoom": 0, "z": false, "ok": false },
			"SNS": { "i": -90, "color": "#7ac36a", "e": 0.4, "zoom": 0, "z": true, "ok": false },
			"HEO": { "i": 30, "color": "#de1f2a", "e": 0.4, "zoom": 0, "z": false, "ok": false },
			"LEO": { "i": -30, "color": "#cccccc", "e": 0.4, "zoom": 0, "z": true, "ok": false },
			"EM2": { "i": 0, "color": "#cccccc", "e": 1, "zoom": 1, "z": false, "ok": false },
			"ES2": { "i": 0, "color": "#9467bd", "e": 1, "zoom": 1, "z": false, "ok": false },
			"ETR": { "i": 0, "color": "#fac900", "e": 1, "zoom": 1, "z": false, "ok": false }
		}
		
		
		// Update if they are ok to use
		if(!inp.orbits) inp.orbits = ["GEO","SNS","HEO","LEO","EM2","ES2","ETR"];
		for(var i = 0; i < inp.orbits.length; i++){
			if(this.orbits[inp.orbits[i]]) this.orbits[inp.orbits[i]].ok = true;
		}
		// Auto-zoom if we are only showing one orbit
		if(inp.orbits.length==1) this.zoom = this.orbits[inp.orbits[0]].zoom;

		// If we don't have a convertValue function we make a dummy
		if(!this.spacetel.convertValue || !is(this.spacetel.convertValue,"function")) this.spacetel.convertValue = function(inp){ return inp; };
		
		// Add resize function
		$(window).on('resize',{me:this},function(e){ e.data.me.resize(); });

		return this;
	}

	OrbitAnimation.prototype.resize = function(){

		// Hide the contents so we can calculate the size of the container
		if(this.el.length > 0) this.el.children().hide();

		// Make the element fill the container's width
		this.el.css({'width':'auto','display':'block'});
		
		// Get the inner width of the space container (i.e. without margins)
		var w = this.el.innerWidth();
		if(w < this.el.parent().width()/2) w = this.el.parent().width()-(parseInt(this.el.css('margin-left'),10) + parseInt(this.el.css('margin-right'),10));
		var h = w/2;

		// Check if the HTML element has changed size due to responsive CSS
		if(w != this.width || h != this.height || this.width==0){
			this.width = w;
			if(this.width == 0) this.width = this.el.parent().width()-(parseInt(this.el.css('margin-left'),10) + parseInt(this.el.css('margin-right'),10));
			this.height = (this.heightscale) ? this.width*this.heightscale : h;

			// Create the Raphael object to hold the vector graphics
			if(!this.paper){
				this.paper = Raphael(this.id, this.width, this.height);
			}else{
				this.paper.setSize(this.width,this.height);
				this.rebuild = true;
			}
			// Define Earth and Moon
			this.E = { x: this.width/2, y: this.height/2, r: this.height/6, radius: 6378 };
			this.M = { r: 5, o: this.E.r*58 };
		}

		// Calculate the orbits to show
		this.displayOrbits();

		// Show the contents again
		this.el.children().show();

		return this;
	}

	OrbitAnimation.prototype.removeOrbits = function(){
		for(var o in this.orbits){
			var oo = this.svg.orbits[o];
			if(oo){
				if(oo.dotted) oo.dotted.stop().remove();
				if(oo.solid) oo.solid.stop().remove();
				if(oo.satellite) oo.satellite.stop().remove();
				delete this.svg.orbits[o];
			}
		}
		var a = ['Moon','Moonorbit','Moonlagrangian','Earthorbit'];
		for(var i = 0 ; i < a.length; i++){
			if(this[a[i]]){
				this[a[i]].remove();
				delete this[a[i]];
			}
		}
		for(var l in this.labels){
			var ll = this.labels[l];
			for(var i in ll){
				if(is(ll[i].remove,"function")){
					ll[i].remove();
					delete ll[i];
				}
			}
			delete this.labels[l];
		}
		return this;
	}

	OrbitAnimation.prototype.displayOrbits = function(key,zoom){

		if(!this.paper) return this;

		// Update the orbital size of the HEO as it depends on the size of the Earth
		if(this.orbits["HEO"]) this.orbits["HEO"].r = this.E.r*3.3;
		
		if(key) this.zoom = this.orbits[key].zoom;
		if(is(zoom,"number")) this.zoom = zoom;

		// r - radius
		// e - ellipticity
		// a - inclination angle
		function makeOrbitPath(r,e,a){
			if(!a || !is(a,"number")) a = 0;
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

		if(this.rebuild){
			this.removeOrbits();
			this.rebuild = false;
		}

		if(this.interactive){
			if($('#'+this.id+' .zoomer').length==0){
				$('#'+this.id).prepend('<a href="#" class="zoomer button">-</a>');
				$('#'+this.id+' .zoomer').on('click',{me:this},function(e){
					e.preventDefault();
					e.data.me.displayOrbits('',(e.data.me.zoom==0 ? 1 : 0));
					$(this).html(e.data.me.zoom==0 ? '&minus;' : '&plus;').attr('title',(e.data.me.zoom==0 ? e.data.me.phrases.zoomout : e.data.me.phrases.zoomin));
				});
			}
		}

		if(this.Earth) this.Earth.remove();
		if(this.zoom == 0) this.Earth = this.paper.path('M '+(this.E.x)+' '+(this.E.y)+' m -6.92,42.86 c -10.79,-1.89 -21.17,-8.25 -27.52,-16.87 -15.02,-20.39 -9.63,-48.89 11.79,-62.41 16.94,-10.68 39.20,-8.16 53.44,6.06 5.87,5.86 9.54,12.35 11.55,20.40 1.16,4.68 1.47,12.35 0.67,16.96 -3.04,17.58 -15.44,30.93 -32.72,35.25 -4.33,1.08 -12.80,1.38 -17.21,0.61 z m 11.33,-4.82 c 6.97,-0.79 13.53,-3.42 19.13,-7.67 1.15,-0.87 1.54,-1.39 1.55,-2.07 0.01,-1.02 1.44,-5.01 2.21,-6.20 0.27,-0.42 1.14,-1.04 1.93,-1.38 1.16,-0.50 1.55,-0.90 2.12,-2.23 0.96,-2.24 1.24,-3.45 0.78,-3.45 -0.20,0 -0.37,-0.35 -0.37,-0.78 0,-0.79 1.79,-2.69 4.39,-4.66 0.67,-0.50 1.30,-1.14 1.40,-1.40 0.83,-2.18 0.99,-12.83 0.19,-12.83 -0.51,0 -0.70,2.11 -0.37,4.19 0.41,2.56 0.09,4.28 -0.80,4.41 -1.26,0.18 -2.13,-1.28 -2.84,-4.81 -1.04,-5.22 -1.12,-5.32 -4.56,-5.92 -1.02,-0.17 -1.08,-0.13 -1.08,0.81 0,2.22 -2.80,5.66 -5.01,6.15 -1.66,0.36 -2.62,-0.58 -4.17,-4.11 -0.73,-1.67 -1.59,-3.31 -1.92,-3.62 -0.55,-0.54 -0.58,-0.53 -0.58,0.12 0,1.72 2.25,7.61 3.13,8.19 0.20,0.13 1.09,0.24 1.97,0.25 2.19,0.00 3.57,0.75 3.56,1.93 -0.01,1.61 -1.23,3.68 -3.44,5.82 -2.98,2.89 -3.55,3.94 -3.55,6.53 -0.00,2.03 0.02,2.10 0.75,1.87 0.41,-0.12 1.04,-0.43 1.41,-0.68 0.98,-0.67 2.09,-0.56 2.35,0.23 0.24,0.77 -1.60,3.96 -3.39,5.87 -0.87,0.93 -1.18,1.07 -1.83,0.82 -0.67,-0.25 -0.78,-0.51 -0.76,-1.84 0.01,-0.95 -0.11,-1.50 -0.33,-1.43 -0.34,0.10 -0.65,0.55 -2.65,3.74 -1.17,1.88 -3.79,3.67 -6.07,4.16 -1.86,0.39 -3.48,0 -3.48,-0.79 0,-0.26 -0.43,-1.29 -0.96,-2.30 -1.69,-3.22 -1.84,-3.99 -1.37,-7.24 0.47,-3.33 0.19,-4.72 -1.21,-6.04 -1.23,-1.15 -1.87,-2.53 -1.64,-3.58 0.18,-0.83 0.08,-0.93 -1.34,-1.35 -1.63,-0.48 -5.15,-0.33 -7.61,0.33 -1.09,0.30 -1.50,0.23 -2.83,-0.42 -2.86,-1.42 -4.32,-4.81 -3.89,-9.11 0.39,-4.01 0.54,-4.51 1.80,-5.97 0.68,-0.78 1.43,-1.90 1.67,-2.47 0.39,-0.94 1.89,-1.94 3.70,-2.47 0.29,-0.08 0.93,-0.95 0.19,-1.19 -2.63,0.61 -3.49,-1.84 -1.69,-3.63 0.98,-0.98 1.35,-1.14 2.33,-1.03 1.08,0.12 1.16,0.07 1.16,-0.77 0,-0.49 0.15,-1.00 0.33,-1.12 0.18,-0.11 1.44,-0.95 1.44,-1.06 0,-0.36 -4.64,1.86 -2.85,-0.67 -0.26,0.41 -0.65,0.19 -1.12,-0.26 -0.87,-0.87 0.29,-1.80 1.00,-1.97 0.45,-0.00 0.96,1.28 1.31,0.58 -0.82,-1.14 -0.62,-2.63 -0.28,-2.70 1.28,-0.53 1.49,0.78 1.49,1.81 0,0.39 0.22,0.91 0.50,1.14 0.27,0.23 0.50,0.79 0.50,1.25 0,0.76 0.09,0.81 1.06,0.62 1.49,-0.30 2.53,-1.36 2.47,-2.53 2.67,-1.78 -0.15,-1.06 -0.29,-1.20 -0.63,-0.63 -0.13,-1.83 1.40,-3.38 2.14,-2.15 3.38,-2.70 6.99,-3.13 2.72,-0.32 3.09,-0.29 4.55,0.35 1.48,0.64 1.57,0.76 1.38,1.70 l -0.20,0.99 1.80,-0.96 c 0.99,-0.53 2.56,-1.15 3.49,-1.39 0.93,-0.23 1.69,-0.56 1.69,-0.72 0,-0.38 -4.20,-2.31 -6.97,-3.21 -5.23,-1.70 -13.51,-2.25 -18.83,-1.23 -4.60,0.87 -12.69,4.14 -13.13,5.31 -0.08,0.23 0.06,0.97 0.34,1.64 0.63,1.52 0.65,3.66 0.04,4.84 -0.61,1.18 -5.09,5.49 -6.37,6.14 -0.55,0.27 -2.28,0.92 -3.84,1.42 -4.30,1.40 -4.48,1.53 -5.46,3.96 -1.64,4.10 -2.26,7.13 -2.45,11.88 l -0.17,4.50 2.56,2.13 c 1.40,1.17 3.47,3.15 4.59,4.40 1.51,1.69 2.48,2.45 3.82,2.99 1.96,0.79 3.45,2.28 3.45,3.44 0,0.40 -0.24,1.46 -0.53,2.32 -0.49,1.46 -0.49,1.69 0.02,3.04 0.62,1.63 0.35,2.62 -0.81,3.00 -0.81,0.26 -0.85,1.23 -0.10,2.39 0.31,0.47 0.65,1.48 0.75,2.23 0.17,1.29 0.34,1.48 3.26,3.42 7.40,4.93 16.42,7.13 25.16,6.13 z m 8.48,-49.91 c 0.68,-0.67 0.66,-1.12 -0.05,-1.33 -0.32,-0.10 -2.25,-1.55 -2.92,-1.89 -1.01,-0.49 6.71,-1.01 1.45,-3.16 -5.26,-2.15 -2.56,4.83 -3.32,3.88 -0.65,-0.83 -2.00,-1.01 -2.58,-0.48 -1.15,-1.28 -2.98,-3.84 -3.70,-3.89 -1.03,-0.07 1.16,2.32 -0.27,2.81 -1.44,0.48 -2.20,-2.82 -4.09,-2.61 -2.10,0.23 -4.38,-0.72 -5.18,3.39 -0.00,0.52 3.06,0.16 4.50,0 2.32,-0.30 3.10,0 5.24,1.91 l 1.88,1.70 3.25,-0.23 c 2.19,-0.15 3.33,-0.11 3.48,0.12 0.32,0.53 1.72,0.42 2.32,-0.16 z M 4.90,-24.27 c 0.94,-0.43 1.16,-0.71 1.01,-1.25 -0.10,-0.38 -0.18,-0.86 -0.18,-1.09 0.15,-1.64 -0.72,-1.29 -1.57,-0.07 -0.77,1.13 -4.82,5.26 -0.61,2.96 0.07,-0.07 0.69,-0.25 1.35,-0.56 z m 20.69,-1.74 c 0.23,-0.38 -1.04,-1.12 -1.47,-0.86 -0.16,0.10 -0.95,-0.15 -1.74,-0.56 -1.95,-1.02 -6.42,-0.95 -5.77,0.10 0.10,0.17 1.42,0.31 2.92,0.31 2.03,8.3e-4 3.03,0.16 3.90,0.63 1.36,0.73 1.89,0.82 2.16,0.38 z');
		else this.Earth = this.paper.path('M '+(this.E.x)+' '+(this.E.y)+' m 0 -43.6 c,-19.19,-0.35,-37.44,13.34,-41.86,32.01 c,-4.56,17.16,2.72,37.24,17.65,46.97 c,13.37,9.28,32.05,9.99,45.99,1.50 c,5.95,-3.31,11.07,-8.03,14.54,-13.93 c,10.54,-15.64,8.72,-38.18,-4.01,-52.06 c,-8.07,-9.09,-20.11,-14.60,-32.30,-14.49 z m,0.09,5.37 c,12.57,-0.12,24.94,6.59,31.74,17.15 c,-0.94,5.00,-6.08,1.53,-3.04,-1.61 c,-1.45,-0.52,-4.93,2.87,-6.84,-0.60 c,-3.18,-1.30,-6.35,1.69,-5.15,4.18 c,-3.78,2.66,-6.16,-4.18,-10.15,-1.25 c,0.93,-0.71,6.35,-6.13,1.94,-5.74 c,-2.14,3.26,-5.90,5.61,-9.75,6.74 c,-3.03,1.66,3.48,3.91,5.08,3.87 c,4.45,2.28,8.58,7.10,6.19,12.18 c,1.90,3.21,3.99,6.75,2.95,10.74 c,-1.08,1.59,-1.99,6.64,-3.80,5.96 c,0.09,-5.55,-5.85,1.42,-5.90,3.92 c,-0.23,1.60,-2.08,4.66,0.31,3.45 c,1.57,3.03,4.04,1.23,2.57,-1.43 c,-0.75,-2.21,1.07,-4.45,1.43,-0.91 c,3.42,1.98,-2.07,8.02,-3.44,4.22 c,-0.05,3.19,-5.91,4.83,-6.25,5.74 c,2.90,2.90,-1.55,2.07,-3.22,2.25 c,-1.30,5.22,5.49,3.31,6.56,-0.06 c,2.57,-3.12,7.94,2.47,8.21,0.15 c,-5.15,-2.90,4.36,1.49,3.73,-0.17 c,0.35,-3.39,5.71,0.66,6.83,-2.63 c,2.78,1.05,-3.25,4.26,-4.94,4.47 c,-2.71,0.57,-2.35,4.23,-5.75,2.58 c,-3.91,-2.11,-7.99,-0.80,-12.06,-0.15 c,-4.93,2.23,-10.21,1.74,-14.83,-1.38 c,-10.81,-5.56,-18.52,-16.65,-20.00,-28.71 c,2.73,2.98,6.59,4.72,8.99,8.35 c,1.59,0.73,3.94,3.52,4.82,3.17 c,1.83,-2.48,4.15,-5.77,2.79,-8.54 c,3.36,-2.47,-0.28,-5.56,-3.15,-3.52 c,-4.39,0.81,-0.19,-4.94,1.39,-6.23 c,2.85,-0.46,3.51,2.41,3.98,3.73 c,3.31,-0.03,0.83,-3.88,4.37,-4.09 c,0.13,-1.41,-3.48,-2.70,-0.21,-1.77 c,4.26,-1.24,1.63,-4.36,-0.49,-3.17 c,2.76,-2.15,4.18,-7.67,8.50,-6.43 c,2.24,-0.41,2.61,-2.86,1.01,-3.53 c,2.71,-1.83,-1.40,-1.78,-0.10,-4.29 c,-1.83,-0.30,-4.30,-0.97,-2.13,-3.10 c,-3.38,2.57,-3.54,7.86,-8.96,7.39 c,-4.53,1.77,-8.33,-1.76,-12.01,-2.70 c,-1.47,0.69,-6.48,4.76,-4.02,0.66 c,6.58,-11.48,19.53,-19.03,32.80,-18.87 z m,-33.65,21.59 c,-0.63,0.60,-1.28,0.77,0,0 z m,25.03,13.87 c,-1.37,1.63,-4.72,3.73,-0.43,3.84 c,2.05,0.49,5.02,2.34,3.25,-0.95 c,-0.41,-1.86,-2.20,-1.09,-2.81,-2.89 z m,-4.06,1.78 c,-4.15,-0.46,-2.20,6.04,-6.12,6.47 c,-0.60,2.10,2.30,1.32,3.03,1.20 c,1.41,-2.46,3.73,-4.48,3.09,-7.68 z m,3.53,3.03 c,0.05,4.24,-2.37,7.12,-5.92,8.53 c,-2.81,3.20,0.32,5.68,2.91,2.40 c,3.66,0.82,7.45,0.46,8.59,-3.83 c,3.98,-4.13,-1.83,-7.10,-5.59,-7.10 z m,2.65,13.87 c,-4.08,2.58,5.79,0.94,0,0 z m,29.99,1 c,-0.31,2.69,7.00,1.53,2.61,4.52 c,-1.84,0.06,-6.30,-2.59,-2.61,-4.52 z m,-25.09,4.62 c,-2.60,0.71,1.04,4.16,-0.44,4.55 c,-1.43,1.94,4.72,-0.16,1.34,-1.89 c,-0.67,-1.04,-1.06,-1.69,-0.90,-2.65 z m,32.49,0.34 c,-0.01,2.70,-5.79,2.71,-1.54,0.95 l,0.80,-0.42 z m,-12.78,0.37 c,0.52,1.61,4.35,0.62,1.38,2.50 c,-1.24,2.92,-6.66,3.76,-3.93,-0.40 c,1.53,0.53,2.25,-0.75,2.54,-2.09 z m,-21.93,1.15 c,-3.15,1.82,0.36,3.97,0.81,0.93 c,-0.04,-0.43,-0.35,-0.86,-0.81,-0.93 z m,26.43,6.90 c,-1.92,1.51,-1.94,0.16,0,0 z');
		this.Earth.attr({ stroke: 0, fill: '#69DFFF', opacity:0.8 });

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
				p.dotted = _obj.paper.path("M "+(inp.cx-inp.r)+",0 q "+(inp.r*2)+","+(_obj.height/2)+" 0,"+(_obj.height));
				p.solid = _obj.paper.path("M "+(inp.cx-inp.r)+",0 q "+(inp.r*2)+","+(_obj.height/2)+" 0,"+(_obj.height));
			}else{
				if(inp.e==1){
					p.dotted = _obj.paper.circle(inp.cx,inp.cy,inp.r);
					p.solid = _obj.paper.circle(inp.cx,inp.cy,inp.r);
				}else{
					var path = "m "+inp.cx+","+inp.cy+" "+makeOrbitPath(inp.r,inp.e,inp.i);
					p.dotted = _obj.paper.path(path);
					p.solid = _obj.paper.path(path);
				}
			}

			// Make the satellite
			if(inp.period){
				p.satellite = _obj.paper.circle(inp.cx,inp.cy,4).attr({ 'fill': inp.color, 'stroke': 0 });
				if(inp.key!="ES2") p.anim = p.satellite.animateAlong((inp.orbit ? inp.orbit : p.dotted), inp.period, Infinity, inp.orbitdir, inp.z);
			}

			p.dotted.attr({ stroke: inp.color,'stroke-dasharray': '-','stroke-width':inp.stroke.off });
			p.solid.attr({ stroke: inp.color,'opacity':0.1,'stroke-width': 8 });

			// Add mouseover events
			if(is(_obj.callback,"function")){
				var on = function(){ $('#'+this.id).css('cursor','pointer'); this.dotted.attr({"stroke-width": (this.selected ? inp.stroke.selected : inp.stroke.on)}); };
				var off = function(){ $('#'+this.id).css('cursor','default'); this.dotted.attr({"stroke-width": (this.selected ? inp.stroke.selected : inp.stroke.off)}); };
				p.solid.hover(on, off, p, p);
				p.satellite.hover(on, off, p, p);
				p.solid.click(function(){ _obj.callback.call((_obj.spacetel ? _obj.spacetel : this),inp.key); },p,p);
				p.satellite.click(function(){ _obj.callback.call((_obj.spacetel ? _obj.spacetel : this),inp.key); },p,p);
			}

			// Store zoom level this applies to
			p.zoom = _obj.zoom+0;
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

		if(!this.E || !this.M || !this.scale) return this;
		
		if(this.zoom == 0){
			for(var o in this.data){
				if(this.orbits[o] && this.orbits[o].ok && this.orbits[o].zoom == this.zoom && !this.svg.orbits[o]){
					if(o=="HEO"){
						dx = -this.E.r*1.2;
						dy = -this.E.r*0.35;
					}else{
						dx = 0;
						dy = 0;
					}
					if(!this.orbits[o].r) this.orbits[o].r = this.E.r*(1+this.data[o].altitude.value/this.E.radius);
					period = this.spacetel.convertValue(this.data[o].period,'hours');
					this.svg.orbits[o] = makeOrbit({key:o,period:period.value*3*1000,r:this.orbits[o].r,cx:(this.E.x+dx),cy:(this.E.y+dy),color:this.orbits[o].color,e:this.orbits[o].e,i:this.orbits[o].i,z:this.orbits[o].z});
				}
			}
		}else if(this.zoom == 1){
			if(!this.Moonorbit){
				var o = this.svg.orbits;
				this.Moonorbit = this.paper.path("M "+this.E.x+","+this.E.y+" "+makeOrbitPath(this.M.o*this.scale[1],1)).attr({ stroke:'#606060','stroke-dasharray': '-','stroke-width':1.5 });
				this.Moon = this.paper.circle(this.E.x - this.M.o*this.scale[1]*Math.cos(Math.PI/6),this.E.y - this.M.o*this.scale[1]*Math.sin(Math.PI/6),this.M.r).attr({ 'fill': '#606060', 'stroke': 0 });
				var r = 9;
				if(!o["ETR"] && this.data["ETR"] && this.orbits["ETR"].ok){
					period = this.spacetel.convertValue(this.data["ETR"].period,'days');
					this.Earthorbit = this.paper.path("M "+(this.E.x-r)+",0 q "+(r*2)+","+(this.height/2)+" 0,"+(this.height)).attr({ stroke:'#606060','stroke-dasharray': '-','stroke-width':1.5 });
					o["ETR"] = makeOrbit({key:"ETR",period:period.value*1000,r:1,cx:(this.E.x-r*0.78),cy:(this.E.y+2.1*this.M.o*this.scale[1]),color:this.orbits["ETR"].color});
				}
				if(!o["EM2"] && this.data["EM2"] && this.orbits["EM2"].ok){
					this.Moonlagrangian = this.paper.path("M "+this.E.x+","+this.E.y+" "+makeOrbitPath(this.M.o*this.scale[1]*440000/380000,1)).attr({ stroke:'#000000','stroke-dasharray': '-','stroke-width':0.5,'opacity':0.01 });
					period = this.spacetel.convertValue(this.data["EM2"].period,'days');
					this.Moon.animateAlong(this.Moonorbit, period.value*1000, Infinity,-1);
					o["EM2"] = makeOrbit({key:"EM2",period:period.value*1000,orbit:this.Moonlagrangian,orbitdir:-1,r:this.M.o*((440000/380000)-1)*this.scale[1],cx:(this.E.x - this.M.o*this.scale[1]*Math.cos(Math.PI/6)),cy:(this.M.o*this.scale[1]*Math.sin(Math.PI/6)),color:this.orbits["EM2"].color,e:1,i:0});
					o["EM2"].dotted.animateAlong(this.Moonorbit, period.value*1000, Infinity,-1);
					o["EM2"].solid.animateAlong(this.Moonorbit, period.value*1000, Infinity,-1);
				}
				if(!o["ES2"] && this.data["ES2"] && this.orbits["ES2"].ok){
					period = this.spacetel.convertValue(this.data["ES2"].period,'days');
					o["ES2"] = makeOrbit({key:"ES2",period:period.value*1000,r:9,cx:(this.E.x + 4*this.M.o*this.scale[1]),cy:this.E.y,color:this.orbits["ES2"].color});
				}
				var m = this.M.o*this.scale[1];
				var s = 0.3;
				var fs = parseInt(this.el.css('font-size'));
				if(!this.labels) this.labels = {};
				if(!this.labels.sun){
					this.labels.sun = {
						'zoom': 1,
						'arrow': this.paper.path("M "+(this.E.x - 4*m)+","+this.E.y+" l "+(s*m)+',-'+(s*0.3*m)+' q '+(-s*0.3*m)+','+(s*0.3*m)+' 0,'+(s*0.6*m)+' z M '+(this.E.x - 4*m + s*0.85*m)+","+(this.E.y-s*0.05*m)+' l '+(s*m*1.5)+','+(-s*0.05*m)+' l 0,'+(s*0.2*m)+' l '+(-s*m*1.5)+','+(-s*0.05*m)+' z').attr({'fill':'#fac900','stroke':0}),
						'label': this.paper.text((this.E.x - 4*m + 2.5*s*m),(this.E.y),this.phrases.diagram.sun).attr({'fill':'#fac900','stroke':0, 'text-anchor': 'start', 'font-size': fs })
					}
				}
				if(!this.labels.earthorbit && this.data["ETR"] && this.orbits["ETR"].ok){
					this.labels.earthorbit = {
						'zoom': 1,
						'arrow': this.paper.path("M "+(this.E.x)+","+(this.E.y-2.1*m)+' l -'+(s*0.3*m)+','+(s*m)+' q '+(s*0.3*m)+','+(-s*0.3*m)+' '+(s*0.6*m)+',0 z M '+(this.E.x - s*0.05*m)+","+(this.E.y - 2.1*m + s*0.85*m)+' l '+(-s*0.05*m)+','+(s*m*1.5)+' l '+(s*0.2*m)+',0 l '+(-s*0.05*m)+','+(-s*m*1.5)+' z').attr({'fill':'#999999','stroke':0}),
						'label': this.paper.text((this.E.x+s*0.3*m),(this.E.y - 2*m + s*m),this.phrases.diagram.earthorbit).attr({'fill':'#999999','stroke':0, 'text-anchor': 'start', 'font-size': fs })
					}
				}
			}
		}

		for(var o in this.svg.orbits){
			if(this.svg.orbits[o].zoom!=this.zoom) hide(this.svg.orbits[o]);
			else show(this.svg.orbits[o]);
			if(this.zoom == 0){
				hide(this.Moonorbit);
				hide(this.Moon);
			}else{
				show(this.Moonorbit);			
				show(this.Moon);
			}
			if(this.svg.orbits["EM2"]){
				if(this.zoom == 0){
					hide(this.Moonlagrangian);
					hide(this.Earthorbit);
				}else{
					show(this.Moonlagrangian);
					show(this.Earthorbit);
				}
			}
		}
		for(var l in this.labels){
			var ll = this.labels[l];
			if(ll.zoom!=this.zoom){
				hide(ll.arrow);
				hide(ll.label);
			}else{
				show(ll.arrow);
				show(ll.label);
			}
		}

		// Scale the Earth. SVG size is 48px so we scale that first;
		var scale = this.E.r/48;
		// If we are in Earth-Moon view we scale the Earth so that it is visible
		if(this.scale[this.zoom] < 1) scale *= this.scale[this.zoom]*10;
		// Now scale the path
		if(this.Earth) transformer(this.Earth,['S',scale,scale,this.E.x,this.E.y]);
		
		return this;
	}
	
	
	// Highlight the selected orbit (uses the value from the select dropdown)
	// If necessary (i.e. if the zoom level has changed) redisplay the orbits first.
	OrbitAnimation.prototype.highlight = function(key){

		if(!key) return this;

		this.displayOrbits(key);

		// Update SVG elements
		for(var o in this.svg.orbits){
			if(o==key) this.svg.orbits[o].selected = true;
			else this.svg.orbits[o].selected = false;
			this.svg.orbits[o].dotted.attr({'stroke-width':(this.svg.orbits[o].selected ? this.svg.orbits[o].inp.stroke.selected : this.svg.orbits[o].inp.stroke.off)});
			this.svg.orbits[o].satellite.attr({'r':(this.svg.orbits[o].selected ? 8 : 4),'stroke-width':(this.svg.orbits[o].selected ? 8 : 0),'stroke':'white','stroke-opacity':0.5});
		}

		return this;
	}

	// Create a Thermometer
	function Thermometer(inp){
		if(!inp) inp = {};
		this.id = (is(inp.id,"string")) ? inp.id : 'thermometer';
		this.pb = (inp.phrasebook) ? inp.phrasebook : { 'y' :'' };
		this.txt = (inp.txt) ? inp.txt : {'font':'12px','fill':'#ffffff','text-anchor':'start'};
		this.labeltxt = (inp.labeltxt) ? inp.labeltxt : {'font':'10px','text-anchor':'start','fill':'#ffffff'};
		this.format = (is(inp.format,"function")) ? inp.format : function(v){ return addCommas(v.value)+' K'; };
		this.ctx = (is(inp.context,"object")) ? inp.context : this;
		this.colour = (is(inp.color,"string")) ? inp.color : '#df0000';
		this.wide = (is(inp.width,"number")) ? inp.width : (is(inp.canvas,"object")) ? inp.canvas.width : 200;
		this.tall = (is(inp.height,"number")) ? inp.height : (is(inp.canvas,"object")) ? inp.canvas.height : 200;
		this.req = (is(inp.required,"number")) ? inp.required : 300;
		this.xoff = (is(inp.x,"number")) ? inp.x : 0;
		this.yoff = (is(inp.y,"number")) ? inp.y : 0;
		this.p = 7;	// The padding in pixels
		this.tm = [0.1,0.3,1,3,10,30,100,300];	// The tick marks

		// Scale
		this.bulb = 4*this.p;
		this.bottom = this.tall-this.p*9.5;
		this.top = this.p*6;

		// Create a canvas to draw on
		this.thermo = (is(inp.canvas,"object")) ? inp.canvas : Raphael(this.id, this.wide, this.tall);

		this.mercurybase = this.thermo.rect((this.xoff + this.wide/2 - this.p*2.5), this.yoff+this.bottom+this.p, this.p*5, this.bulb).attr({"fill": this.colour,"stroke":0});
		this.mercuryzero = this.thermo.rect((this.xoff + this.wide/2 - this.p*1.5), this.yoff+this.bottom-0.5, this.p*3, Math.abs(this.p+1)).attr({"fill": this.colour,"stroke":0});
		this.mercury = this.thermo.rect(this.xoff+(this.wide/2 - this.p*1.5), this.yoff+this.top, this.p*3, Math.abs(this.top-this.bottom)).attr({"fill": this.colour,"stroke":0});
		this.thermometer = this.thermo.path('M '+(this.xoff+this.wide/2 - this.p)+','+(this.yoff+this.bottom+this.p)+' l 0,'+(this.top-this.bottom-this.p)+' c 0,-'+(this.p)+' '+(this.p*2)+',-'+(this.p)+' '+(this.p*2)+',0 l 0,'+(this.bottom-this.top+this.p)+' c '+(this.p*2)+','+(this.p*0.5)+' '+(this.p*2)+','+this.bulb+' '+(-this.p)+','+this.bulb+' c -'+(this.p*3)+',0 -'+(this.p*3)+',-'+(this.bulb-this.p*0.5)+' '+(-this.p)+',-'+this.bulb+' m -'+(this.p)+',-'+(this.p)+' c -'+(this.p*2.5)+','+(this.p)+' '+(-this.p*3)+','+(this.p*2+this.bulb)+' '+(this.p*2)+','+(this.p*2+this.bulb)+' c '+(this.p*5)+',0 '+(this.p*4.5)+',-'+(this.p+this.bulb)+' '+(this.p*2)+',-'+(this.p*2+this.bulb)+' l 0,-'+(this.bottom-this.top)+' c 0,-'+(this.p*2.5)+' -'+(this.p*4)+', -'+(this.p*2.5)+' -'+(this.p*4)+',0 l0,'+(this.bottom-this.top)).attr({'fill':'#e4f6fe','fill-opacity':1,'stroke':'#000000','stroke-width':1,'stroke-opacity':0.3});
		this.highlight = this.thermo.path('M '+(this.xoff+this.wide/2 - this.p*0.35)+','+(this.yoff+this.bottom+this.p)+' l 0,-'+(this.bottom-this.top+this.p)+' l -'+(this.p*0.3)+',0 l 0,'+(this.bottom-this.top+this.p)+' l 0,'+(this.p*0.25)+' c -'+(this.p*0.5)+','+(this.p*0.25)+' -'+(this.p*1.75)+','+(this.p*0.75)+' -'+(this.p*0.75)+','+(this.p*2)+' c 0,-'+(this.p*0.5)+' '+(this.p*0.1)+',-'+(this.p*1.5)+' '+(this.p)+',-'+(this.p*2)+' z').attr({'opacity':0.5,'fill':'#f7fcfe','fill-opacity':1,'stroke':0});
		this.shade = this.thermo.path('M '+(this.xoff+this.wide/2 + this.p*0.5)+','+(this.yoff+this.bottom+this.p)+' l 0,-'+(this.bottom-this.top+this.p)+' l '+(this.p*0.9)+',0 l 0,'+(this.bottom-this.top+this.p)+' c '+this.p+','+this.p+' '+(this.p*1.25)+','+(this.bulb)+' -'+(this.p*2.5)+','+(this.bulb-this.p*0.75)+' q '+(this.p*3.25)+',-'+(this.bulb*0.1)+' '+(this.p*1.75)+',-'+(this.bulb-this.p)+' z').attr({'opacity':0.2,'fill':'#000000','fill-opacity':1,'stroke':'#000000','stroke-width':1});

		// Thermometer labels and tick marks
		this.labels = this.thermo.set();
		this.ticks = this.thermo.set();
		var x,y;
		for(var i = 0 ; i < this.tm.length ; i++){
			y =  Math.round(this.bottom + (this.top-this.bottom)*this.getYFrac(this.tm[i]))-0.5;
			this.ticks.push(this.thermo.path("M "+(this.xoff + this.wide/2 + 2)+","+(this.yoff + y)+" l "+(this.p*3)+",0").attr({'stroke':'white','stroke-width':1}));
		}
		// Required line
		y =  Math.round(this.bottom + (this.top-this.bottom)*this.getYFrac(this.req))-0.5;
		this.ticks.push(this.thermo.path("M "+(this.xoff + this.wide/2 - this.p*5)+","+(this.yoff + y)+" l "+(this.p*6)+",0").attr({'stroke':'#ffffff','stroke-width':1,'stroke-dasharray':['-']}));
		this.updateLanguage(this.pb);
		return this;	
	}
	Thermometer.prototype.updateLanguage = function(lang){
		this.pb = lang;

		if(this.rl){ this.rl.remove(); }
		y =  Math.round(this.bottom + (this.top-this.bottom)*this.getYFrac(this.req))-0.5;
		this.rl = this.thermo.text(this.xoff + this.wide/2 - this.p*6, this.yoff + y, this.pb.req).attr(this.txt);
		this.rl.attr({'text-anchor':'middle'}).transform("r-90");

		if(this.labels){ this.labels.remove(); }
		for(var i = 0 ; i < this.tm.length ; i++){
			y =  Math.round(this.bottom + (this.top-this.bottom)*this.getYFrac(this.tm[i]))-0.5;
			this.labels.push(this.thermo.text((this.xoff + this.wide/2 + this.p*3.5), (this.yoff + y), htmlDecode(this.format.call(this.ctx,{'value':this.tm[i],'units':'K','dimension':'temperature'}))).attr(this.labeltxt));
		}

		return this;
	}
	Thermometer.prototype.getYFrac = function(temp){
		return (Math.log10(temp)-Math.log10(this.tm[0]))/(Math.log10(this.tm[this.tm.length-1])-Math.log10(this.tm[0]));
	}
	Thermometer.prototype.value = function(temp){
		var s = this.getYFrac(temp)
		// Max out the thermometer
		if((s-1)*(this.bottom-this.top) > this.p) s = 1+(this.p/(this.bottom-this.top));
		if(temp < this.tm[0]) s = 0;
		this.mercury.transform("s1,"+s+',0,'+this.bottom);
		var t = {'value':temp,'units':'K','dimension':'temperature'}
		if(temp <= this.tm[this.tm.length-1]) t.value = this.tm[this.tm.length-1];
		this.labels[this.labels.length-1].attr('text',htmlDecode(this.format.call(this.ctx,t)));
		return this;
	}

	// Create a Flask
	function Flask(inp){
		if(!inp) inp = {};
		this.label = (is(inp.label,"string")) ? inp.label : "";
		this.colour = (is(inp.color,"string")) ? inp.color : $('.science').css('color');
		this.wide = (is(inp.width,"number")) ? inp.width : 50;
		this.tall = (is(inp.height,"number")) ? inp.height : 75;
		this.xoff = (is(inp.x,"number")) ? inp.x : 0;
		this.yoff = (is(inp.y,"number")) ? inp.y : 0;
		this.p = 0.1;
		
		// Create a canvas to draw on
		if(is(inp.canvas,"object")) this.canvas = inp.canvas;
		else return this;
		
		p = this.wide*this.p;
		q = this.tall*this.p;

		this.liquid = this.canvas.rect(this.xoff+p, this.yoff+this.p*this.tall, this.wide-2*p, (1 - 2*this.p)*this.tall).attr({"fill": this.colour,"stroke":0});
		this.flask = this.canvas.path('M'+(this.xoff+p*3.75)+','+(this.yoff+q)+' l '+(p*0.25)+','+(q*0.25)+' l 0,'+(q*3)+' l -'+(p*2.5)+','+(q*3.75)+' q -'+(p*0.5)+','+(q*0.75)+' 0,'+(q)+' l '+(p*7)+',0 q '+(p*0.5)+',-'+(q*0.25)+' 0,-'+q+' l -'+(p*2.5)+',-'+(q*3.75)+' l 0,'+(-q*3)+' l '+(p*0.25)+',-'+(q*0.25)+' l -'+(p*2.5)+',0 m 0,-'+q+' l '+(p*6.25)+',0 l 0,'+(q*10)+' l-'+(p*10)+',0 l 0,-'+(q*10)+' z').attr({'fill':'black','stroke':0})
		this.outline = this.canvas.path('M'+(this.xoff+p*3.75)+','+(this.yoff+q)+' l '+(p*0.25)+','+(q*0.25)+' l 0,'+(q*3)+' l -'+(p*2.5)+','+(q*3.75)+' q -'+(p*0.5)+','+(q*0.75)+' 0,'+(q)+' l '+(p*7)+',0 q '+(p*0.5)+',-'+(q*0.25)+' 0,-'+q+' l -'+(p*2.5)+',-'+(q*3.75)+' l 0,'+(-q*3)+' l '+(p*0.25)+',-'+(q*0.25)+'').attr({'stroke':'white','stroke-width':2});
		this.label = this.canvas.text(this.xoff,this.yoff+this.tall/2,this.label).attr({'font':'10px','text-anchor':'end','fill':'#ffffff'})
		this.value(0); // Set to zero
		return this;
	}
	Flask.prototype.value = function(s){
		// Normalise
		if(s > 1) s = 1;
		if(s < 0) s = 0;
		this.liquid.transform("s1,"+s+',0,'+(this.yoff+this.tall-this.p*this.tall));
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
		var c;
		
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
			this.loc = { x: rocket.offset().left+(rocket.width()/2)-pad.offset().left, y: rocket.offset().top + rocket.height() - pad.offset().top };
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
				var grad = ctx.createRadialGradient(p.loc.x, p.loc.y, 0, p.loc.x, p.loc.y, p.radius);
				c = "rgba("+p.r+", "+p.g+", "+p.b+", "+p.opacity+")";
				grad.addColorStop(0, c);
				grad.addColorStop(0.5, c);
				grad.addColorStop(1, "rgba("+Math.round(p.r*0.9)+", "+Math.round(p.g*0.9)+", "+Math.round(p.b*0.9)+", 0)");
				ctx.fillStyle = grad;
				// Draw particle
				ctx.arc(p.loc.x, p.loc.y, p.radius, Math.PI*2, false);
				ctx.fill();
				
				// Move the particles
				p.remaining_life -= 0.5;
				p.radius += 0.5;
				p.loc.x += p.speed.x;
				p.loc.y -= p.speed.y;
				
				// Regenerate the particles
				if(p.remaining_life < 0 || p.radius < 0) particles[i] = new particle();
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
	function addCommas(s) {
		s += '';
		var x = s.split('.');
		var x1 = x[0];
		var x2 = x.length > 1 ? '.' + x[1] : '';
		var rgx = /(\d+)(\d{3})/;
		while (rgx.test(x1)) {
			x1 = x1.replace(rgx, '$1' + ',' + '$2');
		}
		return x1 + x2;
	}

	function is(v,t){ return (typeof v===t); }

	// Display really large numbers as powers of ten
	function powerOfTen(v,u){
		var p = Math.floor(Math.log10(v));
		var a = Math.round(v/Math.pow(10,p))
		return ''+a+'&times;10<sup>'+p+'</sup>'+u;
	}
	
	// Escape HTML characters
	function htmlDecode(input){ return $('<div />').html(input).text(); }
	
	function centre(lb){
		var wide = $(window).width();
		var tall = $(window).height();
		var l = 0;
		var t = 0;
		l = ((wide-lb.outerWidth())/2);
		lb.css({left:((wide-lb.outerWidth())/2)+'px'});
		if($(window).height() > lb.height()){
			t = ((tall-lb.outerHeight())/2 + $(window).scrollTop());
			$('body').css('overflow-y','hidden');
		}
		lb.css({left:l+"px",top:t+'px','position':'absolute'});
	}
	
	// Update the transforms on a Raphael element
	function transformer(el,trans){
		t = el.data('transform');
		if(is(t,"undefined")) t = el.attr('transform');
		if(!is(t,"object")) t = [];
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
