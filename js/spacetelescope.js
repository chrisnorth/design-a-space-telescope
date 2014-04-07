/*!
	SpaceTelescope
	(c) Stuart Lowe, Chris North 2014
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
	Raphael.el.animateAlong = function(path, duration, repetitions, direction) {
		var element = this;
		element.path = path;
		element.direction = direction;
		element.pathLen = element.path.getTotalLength();    
		duration = (typeof duration === "undefined") ? 5000 : duration;
		repetitions = (typeof repetitions === "undefined") ? 1 : repetitions;
		element.paper.customAttributes.along = function(v) {
			var a = (this.direction && this.direction < 0) ? (1-v)*this.pathLen : (v * this.pathLen);
			var point = this.path.getPointAtLength(a),
				attrs = { cx: point.x, cy: point.y };
			this.rotateWith && (attrs.transform = 'r'+point.alpha);
			return attrs;
		};    
		element.attr({along:0});
		var anim = Raphael.animation({along: 1}, duration);
		element.animate(anim.repeat(repetitions)); 
	};

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
		if(typeof $!=="function"){
			console.log('No jQuery! Abort! Abort!');
			return this;
		}

		this.q = $.query();
		this.i = inp;
		this.stage = "intro";
		this.choices = {};
		this.sections = ['objectives','satellite','instruments','cooling','vehicle','site','orbit','proposal'];
		this.keyboard = true;	// Allow keyboard shortcuts (disable in inputs and textareas)

		// Set some variables
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

		this.loadConfig(this.update);
		this.loadLanguage(this.lang,this.update);
		
		// Build language list
		var list = "";
		for(l in this.langs) list += '<li class="baritem"><a href="#" title="'+this.langs[l]+'" data="'+l+'">'+this.langs[l]+' ['+l+']</a></li>'
		$('#language ul').html(list);
		// Redefine list variable to be the jQuery DOM object
		list = $('#language ul li a');
		// Add click events to each language in the list
		for(var i = 0; i < list.length; i++) $(list[i]).on('click',{me:this},function(e){ e.data.me.loadLanguage($(this).attr('data'),e.data.me.update); });


		// Make menu toggles active
		$('#summary a').on('click',{me:this},function(e){ e.data.me.toggleMenus('summaryext',e); });
		$('a.togglewarning,a.toggleerror').on('click',{me:this},function(e){ e.preventDefault(); e.data.me.toggleMenus('messages'); });
		$('a.togglemenu').on('click',{me:this},function(e){ e.preventDefault(); e.data.me.toggleMenus('menu'); });
		$('a.togglelang').on('click',{me:this},function(e){ e.preventDefault(); e.data.me.toggleMenus('language'); });


		// Add main menu events
		$('.baritem .save').parent().on('click',{me:this},function(e){ e.data.me.save().toggleMenus(); });
		$('.baritem .help').parent().on('click',{me:this},function(e){ e.data.me.toggleGuide(e).toggleMenus(); });
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
		});

		// Attach event to keypresses
		$(document).on('keypress',{me:this},function(e){
			if(!e) e = window.event;
			var code = e.keyCode || e.charCode || e.which || 0;
			e.data.me.keypress(code,e);
		});

		// Attach specific keypress events
		this.registerKey(['g','?'],function(e){ this.toggleGuide(e); });
		this.registerKey(['o'],function(e){ this.showView('options',e); });
		this.registerKey(['r'],function(e){ this.loadLanguage(this.lang,this.updateLanguage); });

		// Deal with back/forwards navigation
		if(this.pushstate){
			var _obj = this;
			window.onpopstate = function(e){ console.log('onpopstate',e); _obj.navigate(e); };
		}

		// Make sure the menu stays attached to the menu bar (unless scrolling down)
		$(document).on('scroll',{me:this},function(e){ e.data.me.scrollMenus(); });

		$('.scriptonly').removeClass('scriptonly');
		
		$(window).resize({me:this},function(e){ e.data.me.resize(); });

		return this;
	}

	// Build a toggle button
	// Inputs
	//   a = { "value": "a", "id": "uniqueid_a", "checked": true }
	//   b = { "value": "b", "id": "uniqueid_b", "checked": false }
	SpaceTelescope.prototype.buildToggle = function(id,a,b){

		if(typeof id!=="string" && typeof a != "object" && typeof b != "object") return "";

		html = '<div class="toggleinput"><label class="toggle-label1" for="'+a.id+'"></label>';
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
	//   
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
	
	SpaceTelescope.prototype.buildPage = function(){

		console.log('buildPage')

		// Disable keyboard shortcuts when in input fields and textareas
		$(document).on('focus','input,textarea',{me:this},function(e){ e.data.me.keyboard = false; }).on('blur','input,textarea',{me:this},function(e){ e.data.me.keyboard = true; });

		// Build scenarios
		$('#scenarios').html('<h2></h2><p class="about"></p><ul id="scenariolist"></ul>');
		$(document).on('click','#scenarios .button',{me:this},function(e){ e.data.me.chooseScenario($(this).attr('data')); });


		// Bind function to process any form changes - must be first bound function
		$(document).on('change','#designer input, #designer select',{me:this},function(e){ e.data.me.parseChoices().updateChoices(); });


		// Add containers for each designer section
		for(var i = 0; i < this.sections.length; i++){
			if($('#designer_'+this.sections[i]).length == 0) $('#output').append('<div id="designer_'+this.sections[i]+'" class="designer"><h2 class="designer_title"><a href="#designer_'+this.sections[i]+'" class="toggle'+this.sections[i]+'"></a></h2><div class="designer_content"><div class="intro"></div><div class="options"></div><div class="questions"></div></div></div>');
		}
		var html = '';
		// Build menu item for each designer section
		for(var i = 0; i < this.sections.length; i++) html += '<li><a href="#designer_'+this.sections[i]+'" class="toggle'+this.sections[i]+'"></a></li>';
		$('#menubar').html('<ul>'+html+'</ul>')

		// Close messages when clicking on a link in the message list
		$(document).on('click','#messages a',{me:this},function(e){
			$('#messages').hide();
		});

		
		// Build the objectives section
		$('#designer_objectives .intro').after('<div class="summary"></div>');


		// Build the satellite section
		$('#designer_satellite .options').html('<div class="bigpadded"><form><ul><li class="option mirror_diameter"><label for="mirror_diameter"></label><select id="mirror_diameter" name="mirror_diameter"></select></li><li class="option mirror_deployable"><label for="mirror_deployable"></label>'+this.buildToggle("toggledeployable",{ "value": "no", "id": "mirror_deployable_no", "label": "", "checked": true },{ "value": "yes", "id": "mirror_deployable_yes", "label": "" })+'</li><li class="option mirror_uv"><label for="mirror_uv"></label>'+this.buildToggle("toggleuv",{ "value": "no", "id": "mirror_uv_no", "checked": true },{ "value": "yes", "id": "mirror_uv_yes" })+'</li></ul></form><div class="details"></div></div>');
		$('#designer_satellite select, #designer_satellite input').on('change',{me:this},function(e){
			e.data.me.showDetails('satellite');
		});


		// Build the instruments section
		$('#designer_instruments .options').html('<div class="bigpadded"><form><ul><li><label for="instruments"></label><select id="wavelengths" name="wavelengths"></select><select id="instruments" name="instruments"></select> <input type="text" id="instrument_name" name="instrument_name" /><a href="#" class="add_instrument"><img src="images/cleardot.gif" class="icon add" /></a></li></ul></form><div class="details"></div></div><div class="instrument_list bigpadded"></div>');
		$('#designer_instruments select').on('change',{me:this},function(e){
			var i = e.data.me.getValue('#instruments');
			var w = e.data.me.getValue('#wavelengths');
			e.data.me.showDetails('instruments',{ 'wavelength': w, 'type': i});
		});
		$('#designer_instruments .add_instrument').on('click',{me:this},function(e){
			e.preventDefault();
			e.data.me.addInstrument();
		});
		$(document).on('click','.remove_instrument',{me:this},function(e){
			e.preventDefault();
			e.data.me.removeInstrument($(this).attr('data'));
		});


		// Build cooling options
		$('#designer_cooling .options').html('<div class="bigpadded"><form><ul><li><label for="hascooling"></label>'+this.buildToggle("hascooling",{ "value": "no", "id": "cooling_no", "checked": true },{ "value": "yes", "id": "cooling_yes" })+'</li></ul></form><div class="details"></div></div>');
		if(this.data.cooling.temperature) $('#designer_cooling .options form ul').append('<li class="hascooling"><label for="cooling_temperature"></label><select id="cooling_temperature" name="cooling_temperature"></select></li>');
		if(this.data.cooling.passive) $('#designer_cooling .options form ul').append('<li class="hascooling"><label for="cooling_passive"></label>'+this.buildToggle("cooling_passive",{ "value": "no", "id": "cooling_passive_no" },{ "value": "yes", "id": "cooling_passive_yes", "checked": true })+'</li>');
		if(this.data.cooling.active) $('#designer_cooling .options form ul').append('<li class="hascooling"><label for="cooling_active"></label>'+this.buildToggle("cooling_active",{ "value": "no", "id": "cooling_active_no", "checked": true },{ "value": "yes", "id": "cooling_active_yes" })+'</li>');
		if(this.data.cooling.cryogenic) $('#designer_cooling .options form ul').append('<li class="hascooling"><label for="cooling_cryogenic"></label><select id="cooling_cryogenic" name="cooling_cryogenic"></select></li>');
		$(document).on('change','#designer_cooling .options input,#designer_cooling .options select',{me:this},function(e){
			if(e.data.me.getValue('input[name=hascooling]:checked')=="yes") $('#designer_cooling li.hascooling').show();
			else $('#designer_cooling li.hascooling').hide();
			e.data.me.showDetails('cooling');
		});

		// Update the launch vehicle section
		html = '<div class="bigpadded">';
		html += '<form><ul class="info">';
		for(var l in this.data.vehicle){
			html += '<li class="'+l+'" data="'+l+'">';
			html += '<div class="image"><img src="" alt="" title="" /></div><div class="operator"><img src="" alt="" title="" /></div>';
			html += '<div class="details">';
			html += '<div class="rocket"></div>';
			html += '<div class="operator"><strong></strong> <span class="value"></span></div>';
			html += '<div class="height"><strong></strong> <span class="value"></span></div>';
			html += '<div class="diameter"><strong></strong> <span class="value"></span></div>';
			html += '<div class="currency"><strong></strong> <span class="value"></span></div>';
			html += '<div class="massLEO"><strong></strong> <span class="value"></span></div><div class="massGTO"><strong></strong> <span class="value"></span></div>';
			if(this.data.vehicle[l].risk) html += '<div class="risk"><strong></strong> <span class="value"></span></div>'
			html += '<div class="sites"><strong></strong> <span class="value"></span></div>';
			html += '<div class="clearall"></div>';
			html += '</div>';
			html += '<div class="selector"><input type="radio" name="vehicle_rocket" id="vehicle_rocket_'+l+'" data="'+l+'" /><label for="vehicle_rocket_'+l+'"></label></div>';
			html += '</li>';
		}
		html += '</ul></form><div class="details"></div></div>';
		$('#designer_vehicle .options').html(html);
		$(document).on('click','#designer_vehicle .options .button',{me:this},function(e){
			e.preventDefault();
			$('#designer_vehicle .info>li.'+$(this).attr('data')).find('input').trigger('click');
		});
		$(document).on('change','#designer_vehicle .options .selector input',{me:this},function(e){
			$('#designer_vehicle .info>li').removeClass('selected');
			$('#designer_vehicle .info>li.'+$(this).attr('data')).addClass('selected').find('input').trigger('click');
		});
		$(document).on('click','#designer_vehicle .options .info>li',{me:this},function(e){
			if(!$(this).hasClass('withinfo')){
				$('.withinfo').removeClass('withinfo');
				$(this).addClass('withinfo');
				$('#designer_vehicle .details').html($(this).find('.details').html()).addClass('padded');
			}
		});


		// Build site options
		$('#designer_site .options').html('<div class="worldmap"><img src="images/worldmap.jpg" /></div><div class="bigpadded"><form><ul><li><label for="site"></label><select id="site" name="site"></select></li></ul></form><div class="details"></div></div>');
		$(document).on('click','#designer_site .launchsite',{me:this},function(e){
			e.preventDefault();
			$('#designer_site #site').val($(this).attr('data'));
			$('#designer_site #site').trigger('change');
		});
		$('#designer_site #site').on('change',{me:this},function(e){
			var site = e.data.me.getValue('#site');
			$('.launchsite').removeClass('selected');
			$('.launchsite[data='+site+']').addClass('selected');
			e.data.me.showDetails('site',site);
		});


		// Build orbit options
		$('#designer_orbit .options').html('<div id="orbits"></div><div class="bigpadded"><form><ul><li><label for="mission_orbit"></label><select id="mission_orbit" name="mission_orbit"></select></li><li><label for="mission_duration"></label><select id="mission_duration" name="mission_duration"></select></li></ul></form><div class="details"></div></div>');
		$('#mission_orbit').on('change',{me:this},function(e){
			var key = e.data.me.getValue('#mission_orbit');
			e.data.me.highlightOrbit(key);
			e.data.me.showDetails('orbit',key);
		});


		// Build proposal document holder
		$('#designer_proposal .options').html('<div class="padded"><div class="doc"></div></div>');



		// Barebones summary table
		this.table = {
			'success': {
				'list': {
					'success_site': {},
					'success_vehicle': {},
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
					'time_fuel': {}
				}
			},
			'science_total': {},
			'profile_total': {
				'list': {
					'profile_site': {},
					'profile_vehicle': {},
					'profile_instruments': {},
					'profile_temperature': {},
					'profile_orbit': {},
					'profile_launch': {},
					'profile_end': {}
				}
			}
		}

		return this;
	}
	
	SpaceTelescope.prototype.resize = function(){

		if(this.modal){
			this.positionModal(this.modal);
		}
		
		// Update the orbit diagram
		this.resizeSpace();
		
		return this;
	}
	
	// Work out where we are based on the anchor tag
	SpaceTelescope.prototype.navigate = function(e){
		var a = location.href.split("#")[1];
		console.log('navigate',a,e);
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
			//if(y < t && y > h) $('.dropdown').css({'top':y-h});
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
			method: 'GET',
			dataType: 'json',
			context: this,
			error: function(){
				console.log('Error loading '+url);
			},
			success: function(data){
				// Store the data
				this.data = data;
				if(typeof fn==="function") fn.call(this);
			}
		});
		return this;
	}

	SpaceTelescope.prototype.getMode = function(){
		return (this.settings.mode=="advanced") ? '_advanced' : '';
	}
	
	// Load the specified language
	// If it fails and this was the long variation of the language (e.g. "en-gb" or "zh-yue"), try the short version (e.g. "en" or "zh")
	SpaceTelescope.prototype.loadLanguage = function(l,fn){
		if(!l) l = this.langshort;
		var m = this.settings.mode;
		var url = this.langurl.replace('%LANG%',l).replace('%MODE%',this.getMode());
	console.log('loadLanguage',l,fn,url)
		$.ajax({
			url: url,
			method: 'GET',
			cache: false,
			dataType: 'json',
			context: this,
			error: function(){
				console.log('Error loading '+l+' ('+m+')');
				if(this.lang.length == 2){
					console.log('Attempting to load default (en) instead');
					this.loadLanguage('en',fn);
				}else{
					if(url.indexOf(this.lang) > 0){
						console.log('Attempting to load '+this.langshort+' instead');
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
				console.log(data.title)
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
			method: 'GET',
			dataType: 'json',
			context: this,
			error: function(){
				console.log('Error loading '+url+' ('+m+')');
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
		this.scenario = this.scenarios[i];
		this.stage = "designer";
		$('#summary').show();
		//$('.baritem.messages').show();
		this.updateSummary();
		this.updateLanguage();
		return this;
	}
	
	// Update the page using the JSON response
	SpaceTelescope.prototype.update = function(){

		console.log('update')

		if(!this.phrases || !this.data) return this;

		this.buildPage();

		this.updateLanguage();

		this.makeSpace();

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
	
	SpaceTelescope.prototype.updateInstruments = function(){
		var d = this.phrases.designer;
		var html = '';
		if(this.choices.instruments.length > 0){
			html += '<h3>'+d.instruments.table.title+'</h3><div class="tablewrapper"><table><tr><th>'+d.instruments.table.name+'</th><th>'+d.instruments.table.type+'</th><th>'+d.instruments.table.cost+'</th><th>'+d.instruments.table.mass+'</th><th>'+d.instruments.table.temperature+'</th><th></th></tr>';
			for(var i = 0; i < this.choices.instruments.length; i++){
				v = this.getInstrument({'wavelength':this.choices.instruments[i].wavelength,'type':this.choices.instruments[i].type})
				html += '<tr><td>'+this.choices.instruments[i].name+'</td><td>'+v.wavelength+' '+v.type+'</td><td>'+this.formatValueSpan(v.cost)+'</td><td>'+this.formatValueSpan(v.mass)+'</td><td>'+this.formatValueSpan(v.temp)+'</td><td><a class="remove_instrument" href="#" title="'+this.phrases.designer.instruments.options.remove+'" data="'+i+'"><img class="icon minus" src="images/cleardot.gif"></a></td></tr>';
			}
			html += '</table></div>';
		}
		$('#designer_instruments .instrument_list').html(html);
		this.parseChoices().updateChoices();
		return this;
	}
	
	SpaceTelescope.prototype.makeSpace = function(zoom){

console.log('makeSpace')

		if(!this.space) this.space = { width: 0, height: 300, zoom: 0, scale: [1,0.022], anim: {}, orbits:{}, labels:{} };
	
		if(zoom) this.space.zoom = zoom;
		//this.space.orbits = {};
		if(!this.space.el) this.space.el = $('#orbits');

		if(!this.space.el.is(':visible')) return this;

		if(!this.space.paper) this.resizeSpace();

		return this;
	}

	SpaceTelescope.prototype.resizeSpace = function(){

		// Hide the contents so we can calculate the size of the container
		this.space.el.children().hide();

		// Check if the HTML element has changed size due to responsive CSS
		if(this.space.el.innerWidth() != this.space.width || this.space.el.innerHeight() != this.space.height){
			this.space.width = this.space.el.width();
			this.space.height = this.space.el.width()/2;
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

console.log('highlightOrbit',key,this.space)

		if(!key) return this;

		this.displayOrbits(key);

		// Update SVG elements
		for(var o in this.space.orbits){
			if(o==key) this.space.orbits[o].selected = true;
			else this.space.orbits[o].selected = false;
			this.space.orbits[o].dotted.attr({'stroke-width':(this.space.orbits[o].selected ? this.space.orbits[o].inp.stroke.selected : this.space.orbits[o].inp.stroke.off)});
			this.space.orbits[o].satellite.attr({'r':(this.space.orbits[o].selected ? 8 : 4)});
		}

		return this;
	}

	SpaceTelescope.prototype.displayOrbits = function(key){

console.log('displayOrbits',key)

		if(!this.space.paper) return this;

		// Properties for the orbit animation
		this.orbits = {
			"GEO": { "inclination": 0, "color": "#048b9f", "ellipticity": 0.3, "zoom": 0 },
			"SNS": { "inclination": -90, "color": "#7ac36a", "ellipticity": 0.4, "zoom": 0 },
			"HEO": { "inclination": 30, "color": "#de1f2a", "ellipticity": 0.4, "r": this.space.E.r*3.3, "zoom": 0 },
			"LEO": { "inclination": -30, "color": "#cccccc", "ellipticity": 0.4, "zoom": 0 },
			"EM2": { "inclination": 0, "color": "#e6e6e6", "ellipticity": 1, "zoom": 1 },
			"ES2": { "inclination": 0, "color": "#9467bd", "ellipticity": 1, "zoom": 1 },
			"ETR": { "inclination": 0, "color": "#fac900", "ellipticity": 1, "zoom": 1 }
		}
		
		if(key) this.space.zoom = this.orbits[key].zoom;

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
		
		if(this.space.rebuild){
			for(var o in this.space.orbits){
				if(this.space.orbits[o].dotted) this.space.orbits[o].dotted.stop().remove();
				if(this.space.orbits[o].solid) this.space.orbits[o].solid.stop().remove();
				if(this.space.orbits[o].satellite) this.space.orbits[o].satellite.stop().remove();
				delete this.space.orbits[o];
			}
			if(this.space.Moon) this.space.Moon.remove();
			if(this.space.Moonorbit) this.space.Moonorbit.remove();
			if(this.space.Moonlagrangian) this.space.Moonlagrangian.remove();
			if(this.space.Earthorbit) this.space.Earthorbit.remove();
			for(var l in this.space.labels){
				if(this.space.labels[l].arrow) this.space.labels[l].arrow.remove();
				if(this.space.labels[l].label) this.space.labels[l].label.remove();
				delete this.space.labels[l];
			}
			this.space.rebuild = false;
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
			if(!inp.r) inp.r = 0;
			if(!inp.color) inp.color = '#999999';
			if(!inp.stroke) inp.stroke = {};
			if(!inp.stroke.on) inp.stroke.on = 2.5;
			if(!inp.stroke.off) inp.stroke.off = 1.5;
			if(!inp.stroke.selected) inp.stroke.selected = 2.5;
			var p = { inp: inp };
			if(inp.e==1){
				p.dotted = _obj.space.paper.circle(inp.cx,inp.cy,inp.r);
				p.solid = _obj.space.paper.circle(inp.cx,inp.cy,inp.r);
			}else{
				var path = "m "+inp.cx+","+inp.cy+" "+makeOrbitPath(inp.r,inp.e,inp.i);
				p.dotted = _obj.space.paper.path(path);
				p.solid = _obj.space.paper.path(path);
			}

			// Make the satellie
			if(inp.period){
				p.satellite = _obj.space.paper.circle(inp.cx,inp.cy,4).attr({ 'fill': inp.color, 'stroke': 0 });
				p.satellite.animateAlong((inp.orbit ? inp.orbit : p.dotted), inp.period, Infinity, inp.orbitdir);
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
					this.space.orbits[o] = makeOrbit({key:o,period:period.value*3*1000,r:this.orbits[o].r,cx:(this.space.E.x+dx),cy:(this.space.E.y+dy),color:this.orbits[o].color,e:this.orbits[o].ellipticity,i:this.orbits[o].inclination});
				}
			}
		}else if(this.space.zoom == 1){
			if(!this.space.Moonorbit){
				this.space.Moonorbit = this.space.paper.path("M "+this.space.E.x+","+this.space.E.y+" "+makeOrbitPath(this.space.M.o*this.space.scale[1],1)).attr({ stroke:'#606060','stroke-dasharray': '-','stroke-width':1.5 });
				this.space.Moon = this.space.paper.circle(this.space.E.x - this.space.M.o*this.space.scale[1]*Math.cos(Math.PI/6),this.space.E.y - this.space.M.o*this.space.scale[1]*Math.sin(Math.PI/6),this.space.M.r).attr({ 'fill': '#606060', 'stroke': 0 });
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
					this.space.orbits["ES2"] = makeOrbit({key:"ES2",period:period.value*1000,r:1,cx:(this.space.E.x + 4*this.space.M.o*this.space.scale[1]),cy:this.space.E.y,color:this.orbits["ES2"].color});
				}
				var r = 9;
				if(!this.space.orbits["ETR"] && this.data.orbit["ETR"]){
					period = this.convertValue(this.data.orbit["ETR"].period,'days');
					this.space.Earthorbit = this.space.paper.path("M "+(this.space.E.x-r)+",0 q "+(r*2)+","+(this.space.height/2)+" 0,"+(this.space.height)).attr({ stroke:'#606060','stroke-dasharray': '-','stroke-width':1.5 });
					this.space.orbits["ETR"] = makeOrbit({key:"ETR",period:period.value*1000,r:1,cx:(this.space.E.x-r*0.78),cy:(this.space.E.y+2.1*this.space.M.o*this.space.scale[1]),color:this.orbits["ETR"].color});
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

	// Update the text of a specific dropdown select box
	// TODO: Keep selected
	SpaceTelescope.prototype.updateDropdown = function(dropdown){

		var options = "";
		var el,o,v;
		el = $('#'+dropdown);
		if(el.length == 0) return this;
		o = el.find('option');

		if(dropdown=="mirror_diameter"){
			if(this.phrases.designer.satellite.options.diameter.placeholder) options = '<option value="">'+this.phrases.designer.satellite.options.diameter.placeholder+'</option>';
			if(o.length == 0){
				for(var m in this.data.mirror) options += '<option value="'+m+'">'+this.formatValue(this.data.mirror[m].diameter)+'</option>';
				el.html(options);
			}else{
				for(var m in this.data.mirror) el.find('option[value="'+m+'"]').text(this.formatValue(this.data.mirror[m].diameter));
			}
		}else if(dropdown=="instruments"){
			if(this.phrases.designer.instruments.options.instrument["none"]) options = '<option value="">'+this.phrases.designer.instruments.options.instrument["none"].label+'</option>';
			for(var m in this.data.instrument.options){
				v = this.phrases.designer.instruments.options.instrument[m].label+(this.data.instrument.options[m].cost ? ' ('+this.formatValue(this.data.instrument.options[m].cost)+')' : '');
				if(o.length == 0) options += '<option value="'+m+'">'+v+'</option>';
				else el.find('option[value="'+m+'"]').text(v);
			}
			if(o.length == 0) el.html(options);
		}else if(dropdown=="wavelengths"){
			if(this.phrases.wavelengths["none"].label) options = '<option value="">'+this.phrases.wavelengths["none"].label+'</option>';
			for(var m in this.data.wavelengths){
				v = this.phrases.wavelengths[m].label;
				if(o.length == 0) options += '<option value="'+m+'">'+v+'</option>';
				else el.find('option[value="'+m+'"]').text(v);
			}
			if(o.length == 0) el.html(options);
		}else if(dropdown=="mission_duration"){
			if(this.phrases.designer.orbit.duration["none"]) options = '<option value="">'+this.phrases.designer.orbit.duration["none"]+'</option>';
			for(var m in this.data.mission){
				v = this.formatValue(this.data.mission[m].life);
				if(o.length == 0) options += '<option value="'+m+'">'+v+'</option>';
				else el.find('option[value="'+m+'"]').text(v);
			}
			if(o.length == 0) el.html(options);
		}else if(dropdown=="mission_orbit"){
			if(this.phrases.designer.orbit.orbit["none"]) options = '<option value="">'+this.phrases.designer.orbit.orbit["none"]+'</option>';
			for(var m in this.data.orbit){
				if(o.length == 0) options += '<option value="'+m+'">'+this.phrases.designer.orbit.options[m].label+'</option>';
				else el.find('option[value="'+m+'"]').text(this.phrases.designer.orbit.options[m].label);
			}
			if(o.length == 0) el.html(options);
		}else if(dropdown=="cooling_temperature"){
			if(this.data.cooling.temperature){
				for(var m in this.data.cooling.temperature){
					v = htmlDecode(this.formatValue(this.data.cooling.temperature[m].temperature));
					if(o.length == 0) options += '<option value="'+m+'">'+v+'</option>';
					else el.find('option[value="'+m+'"]').text(v);
				}
				if(o.length == 0) el.html(options);
			}
		}else if(dropdown=="site"){
			if(this.phrases.designer.site.hint) options = '<option value="">'+this.phrases.designer.site.hint+'</option>';
			for(var m in this.data.site){
				if(this.phrases.designer.site.options[m]){
					v = this.phrases.designer.site.options[m].label
					if(o.length == 0) options += '<option value="'+m+'">'+v+'</option>';
					else el.find('option[value="'+m+'"]').text(v);
				}
			}
			if(o.length == 0) el.html(options);
		}else if(dropdown=="cooling_cryogenic"){
			for(var m in this.data.cooling.cryogenic){
				v = (this.phrases.designer.cooling.options.cryogenic.options[m] ? this.phrases.designer.cooling.options.cryogenic.options[m] : this.formatValue(this.data.cooling.cryogenic[m].life));
				if(o.length == 0) options += '<option value="'+m+'">'+v+'</option>';
				else el.find('option[value="'+m+'"]').text(v);
			}
			if(o.length == 0) el.html(options);
		}
		return this;
	}
	
	SpaceTelescope.prototype.updateLanguage = function(){

		if(!this.phrases || !this.data) return this;

		var d = this.phrases;
		var html,i,r,li,rk;
		
		// Update page title (make sure we encode the HTML entities)
		if(d.title) $('html title').text(htmlDecode(d.title));

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
		this.updateDropdown('mirror_diameter');
		$('#designer_satellite .options .mirror_deployable label').html(d.designer.satellite.options.deployable.label);
		$('#designer_satellite .options .mirror_uv label').html(d.designer.satellite.options.uv.label);
		if(d.designer.satellite.intro) $('#designer_satellite .intro').html(d.designer.satellite.intro).addClass('bigpadded');
		this.updateToggle({ "id": "mirror_deployable_no", "label": this.phrases.designer.satellite.options.deployable.no }, { "id": "mirror_deployable_yes", "label": this.phrases.designer.satellite.options.deployable.yes }, this.phrases.designer.satellite.options.deployable.label);
		this.updateToggle({ "id": "mirror_uv_no", "label": this.phrases.designer.satellite.options.uv.no }, { "id": "mirror_uv_yes", "label": this.phrases.designer.satellite.options.uv.yes }, this.phrases.designer.satellite.options.uv.label);



		// Update the instruments section
		// TODO: update selected
		this.updateDropdown('instruments');
		this.updateDropdown('wavelengths');
		$('#designer_instruments .options label').html(d.designer.instruments.options.label);
		$('#designer_instruments .options input#instrument_name').attr('placeholder',d.designer.instruments.options.name);
		$('#designer_instruments .options a.add_instrument').attr('title',d.designer.instruments.options.add);
		if(d.designer.instruments.intro) $('#designer_instruments .intro').html(d.designer.instruments.intro.replace(/%MAX%/,this.data.instrument.maxsize.length)).addClass('bigpadded');

		// Update the cooling section
		// TODO: update selected
		if(d.designer.cooling.intro) $('#designer_cooling .intro').html(d.designer.cooling.intro).addClass('bigpadded');
		$('#designer_cooling .options label[for=hascooling]').html(d.designer.cooling.enable.label);
		this.updateToggle({ "id": "cooling_no", "label": d.designer.cooling.enable.no }, { "id": "cooling_yes", "label": d.designer.cooling.enable.yes }, this.phrases.designer.cooling.enable.label);
		if(d.designer.cooling.options.temperature){
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
		$('#designer_proposal .options .doc').html(d.designer.proposal.doc.replace(/%FUNDER%/g,'Funder').replace(/%DATE%/,(new Date()).toDateString()).replace(/%TO%/,'<input type="text" name="proposal_to" id="proposal_to" value="" >').replace(/%NAME%/,'<input type="text" name="proposal_name" id="proposal_name" value="" >').replace(/%AIM%/,'<textarea name="proposal_aim" id="proposal_aim"></textarea>').replace(/%PREVIOUS%/,'<input type="text" name="proposal_previous" id="proposal_previous" value="" >').replace(/%ADVANCE%/,'<textarea name="proposal_advance" id="proposal_advance"></textarea>').replace(/%INSTRUMENTS%/,'<textarea name="proposal_instruments" id="proposal_instruments"></textarea>').replace(/%GOALS%/,'<textarea name="proposal_goal" id="proposal_goal"></textarea>').replace(/%RESLOW%/,'<input type="text" name="proposal_reslow" id="proposal_reslow" value="" >').replace(/%RESHIGH%/,'<input type="text" name="proposal_reshigh" id="proposal_reshigh" value="" >').replace(/%MIRROR%/,'<input type="text" name="proposal_mirror" id="proposal_mirror" value="" >').replace(/%REQTEMPERATURE%/,'<input type="text" name="proposal_reqtemp" id="proposal_reqtemp" value="" >').replace(/%TEMPERATURE%/,'<input type="text" name="proposal_temp" id="proposal_temp" value="" >').replace(/%MASS%/,'<input type="text" name="proposal_mass" id="proposal_mass" value="" >').replace(/%MASSSATELLITE%/,'<input type="text" name="proposal_mass_satellite" id="proposal_mass_satellite" value="" >').replace(/%MASSMIRROR%/,'<input type="text" name="proposal_mass_mirror" id="proposal_mass_mirror" value="" >').replace(/%MASSCOOLING%/,'<input type="text" name="proposal_mass_cooling" id="proposal_mass_cooling" value="" >').replace(/%MASSINSTRUMENTS%/,'<input type="text" name="proposal_mass_instruments" id="proposal_mass_instruments" value="" >').replace(/%ORBIT%/,'<input type="text" name="proposal_orbit" id="proposal_orbit" value="" >').replace(/%DISTANCE%/,'<input type="text" name="proposal_distance" id="proposal_distance" value="" >').replace(/%PERIOD%/,'<input type="text" name="proposal_period" id="proposal_period" value="" >').replace(/%FUEL%/,'<input type="text" name="proposal_fuel" id="proposal_fuel" value="" >').replace(/%DURATION%/,'<input type="text" name="proposal_duration" id="proposal_duration" value="" >').replace(/%VEHICLE%/,'<input type="text" name="proposal_vehicle" id="proposal_vehicle" value="" >').replace(/%OPERATOR%/,'<input type="text" name="proposal_operator" id="proposal_operator" value="" >').replace(/%SITE%/,'<input type="text" name="proposal_site" id="proposal_site" value="" >').replace(/%LAUNCHMASS%/,'<input type="text" name="proposal_launchmass" id="proposal_launchmass" value="" >').replace(/%COST%/,'<input type="text" name="proposal_cost" id="proposal_cost" value="" >').replace(/%COSTSATELLITE%/,'<input type="text" name="proposal_cost_satellite" id="proposal_cost_satellite" value="" >').replace(/%COSTMIRROR%/,'<input type="text" name="proposal_cost_mirror" id="proposal_cost_mirror" value="" >').replace(/%COSTCOOLING%/,'<input type="text" name="proposal_cost_cooling" id="proposal_cost_cooling" value="" >').replace(/%COSTINSTRUMENTS%/,'<input type="text" name="proposal_cost_instruments" id="proposal_cost_instruments" value="" >').replace(/%COSTDEV%/,'<input type="text" name="proposal_cost_dev" id="proposal_cost_dev" value="" >').replace(/%COSTLAUNCH%/,'<input type="text" name="proposal_cost_launch" id="proposal_cost_launch" value="" >').replace(/%COSTGROUND%/,'<input type="text" name="proposal_cost_ground" id="proposal_cost_ground" value="" >').replace(/%COSTOPERATIONS%/,'<input type="text" name="proposal_cost_operations" id="proposal_cost_operations" value="" >'));

		// Update designer toggle buttons
		for(var i = 0; i < this.sections.length; i++){
			if(d.designer[this.sections[i]]) $('.toggle'+this.sections[i]).text(d.designer[this.sections[i]].label).attr('title',d.designer[this.sections[i]].hint);
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

		var li = '';
		for(var i = 0; i < this.scenarios.length; i++) li += '<li><div class="padded"><h3>'+this.scenarios[i].name+'</h3><p>'+this.formatScenario(this.scenarios[i])+'</p><a href="#designer_objectives" class="button" title="'+this.scenarios[i].name+'" data="'+i+'">Choose this mission<!--LANGUAGE--></a></div></li>';
		$('#scenariolist').html(li);
		$('#scenarios h2').html(d.scenarios.title);
		$('#scenarios p.about').html(d.scenarios.intro);

		
		// Update values to be consistent with current user preferences
		this.updateUnits();


		$('#messages h3.warning .title').text(this.phrases.ui.warning.title);
		$('#messages h3.error .title').text(this.phrases.ui.error.title);



		// Update summary table labels
		var s = d.ui.summary;

		this.table.success.label = s.success.title;
		if(this.data.site[this.choices.site] && this.data.site[this.choices.site].risk) this.table.success.list.success_site.label = s.success.site;
		if(this.data.vehicle[this.choices.vehicle] && this.data.vehicle[this.choices.vehicle].risk) this.table.success.list.success_vehicle.label = s.success.vehicle;
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
		this.table.time_dev_total.list.time_fuel.label = s.time.fuel;
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
			var w = this.data.wavelengths[value.wavelength];
			if(w.cost) cost = w.cost;
			if(w.mass) mass = w.mass;
			if(w.temperature) temp = w.temperature;
			v.wavelength = this.phrases.wavelengths[value.wavelength].label;
		}
		if(value["type"] && this.data.instrument.options[value["type"]]){
			var t = this.data.instrument.options[value["type"]];
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
	SpaceTelescope.prototype.showDetails = function(area,value){
		var html = '';
		if(!area || area == "") return this;
		
		var d = this.phrases.designer;

		this.parseChoices().updateChoices();

		if(area=="satellite"){

			if(this.choices.mirror && this.data.mirror[this.choices.mirror]){
				var m = this.data.mirror[this.choices.mirror];
				var cost = this.copyValue(m.cost);
				var mass = this.copyValue(m.mass);
				var time = this.copyValue(m.devtime);
				
				if(this.choices.deployablemirror){
					if(this.data.deployablemirror.multiplier.cost) cost.value *= this.data.deployablemirror.multiplier.cost;
					if(this.data.deployablemirror.multiplier.mass) mass.value *= this.data.deployablemirror.multiplier.mass;
					if(this.data.deployablemirror.multiplier.time) time.value *= this.data.deployablemirror.multiplier.time;
				}
				if(this.choices.uvmirror){
					if(this.data.uvmirror.multiplier.cost) cost.value *= this.data.uvmirror.multiplier.cost;
					if(this.data.uvmirror.multiplier.mass) mass.value *= this.data.uvmirror.multiplier.mass;
					if(this.data.uvmirror.multiplier.time) time.value *= this.data.uvmirror.multiplier.time;
				}

				html += '<div><strong>'+d.satellite.cost+'</strong> '+this.formatValueSpan(cost)+'</div>';
				html += '<div><strong>'+d.satellite.mass+'</strong> '+this.formatValueSpan(mass)+'</div>';
				html += '<div><strong>'+d.satellite.devtime+'</strong> '+this.formatValueSpan(time)+'</div>';
				html += '<div><strong>'+d.satellite.bus.cost+'</strong> '+this.formatValueSpan(m.bus.cost)+'</div>';
				html += '<div><strong>'+d.satellite.bus.mass+'</strong> '+this.formatValueSpan(m.bus.mass)+'</div>';
				html += '<div><strong>'+d.satellite.bus.devtime+'</strong> '+this.formatValueSpan(m.bus.devtime)+'</div>';
				html += '<div><strong>'+d.satellite.bus.diameter+'</strong> '+this.formatValueSpan(m.bus.diameter)+'</div>';
				html += '<div><strong>'+d.satellite.bus.slots+'</strong> '+this.formatValueSpan(m.bus.instrumentslots)+'</div>';
			}

		}else if(area=="instruments"){

			value = this.getInstrument(value);
			
			html += '<div><strong>'+d.instruments.cost+'</strong> '+this.formatValueSpan(value.cost)+'</div>';
			html += '<div><strong>'+d.instruments.mass+'</strong> '+this.formatValueSpan(value.mass)+'</div>';
			html += '<div><strong>'+d.instruments.temperature+'</strong> '+this.formatValueSpan(value.temp)+'</div>';
			html += '<div><strong>'+d.instruments.devtime+'</strong> '+this.formatValueSpan(value.time)+'</div>';

		}else if(area=="cooling"){

			var cost = this.makeValue(0,'GBP');
			var mass = this.makeValue(0,'kg');
			var time = this.makeValue(0,'months');

			html += '<div><strong>'+d.cooling.cost+'</strong> '+this.formatValueSpan(this.choices.cooling.cost)+'</div>';
			html += '<div><strong>'+d.cooling.mass+'</strong> '+this.formatValueSpan(this.choices.cooling.mass)+'</div>';
			if(this.choices.cooling.time.value > 0) html += '<div><strong>'+d.cooling.devtime+'</strong> '+this.formatValueSpan(this.choices.cooling.time)+'</div>';
			html += '<div><strong>'+d.cooling.life+'</strong> '+this.formatValueSpan(this.choices.cooling.life)+'</div>';
			html += '<div><strong>'+d.cooling.risk+'</strong> '+this.formatValueSpan(this.choices.cooling.risk)+'</div>';

		}else if(area=="site"){

			if(typeof this.data.site[value].latitude==="number") html += '<div><strong>'+d.site.location+'</strong> <span class="value">'+this.data.site[value].latitude.toFixed(2)+'&deg;, '+this.data.site[value].longitude.toFixed(2)+'&deg;</span></div>';
			if(this.data.site[value].operator) html += '<div><strong>'+d.site.operator+'</strong> <span class="value">'+this.phrases.operator[this.data.site[value].operator].label+'</span></div>';
			html += '<div><strong>'+d.site.trajectories+'</strong> <span class="value">'+d.site.options[value].trajectories+'</span></div>';
			html += '<div><strong>'+d.site.orbits+'</strong> <span class="value">'
			for(var o in this.data.site[value].orbits){
				if(this.data.site[value].orbits[o]) html += ''+d.orbit.options[o].label+'<br />';
			}
			html += '</span></div>';
			
			if(typeof this.data.site[value].risk==="number") html += '<div><strong>'+d.site.risk+'</strong> <span class="value">'+(this.data.site[value].risk*100).toFixed(0)+'%</span></div>';
			
		}else if(area=="orbit"){

			if(this.data.orbit[value].altitude) html += '<div><strong>'+d.orbit.altitude+'</strong> '+this.formatValueSpan(this.data.orbit[value].altitude)+'</div>';
			if(this.data.orbit[value].period) html += '<div><strong>'+d.orbit.period+'</strong> '+this.formatValueSpan(this.data.orbit[value].period)+'</div>';
			if(this.data.orbit[value].obsfrac) html += '<div><strong>'+d.orbit.obsfrac+'</strong> '+this.formatValueSpan({'value':this.data.orbit[value].obsfrac*100,'units':'%','dimension':'percent'})+'</div>';
			if(this.data.orbit[value].fuellife) html += '<div><strong>'+d.orbit.fuellife+'</strong> '+this.formatValueSpan(this.data.orbit[value].fuellife)+'</div>';
			if(this.data.orbit[value].temperature) html += '<div><strong>'+d.orbit.temperature+'</strong> '+this.formatValueSpan(this.data.orbit[value].temperature)+'</div>';
			if(this.data.orbit[value].groundcost) html += '<div><strong>'+d.orbit.groundcost+'</strong> '+this.formatValueSpan(this.data.orbit[value].groundcost)+'</div>';

		}

		html += '<div class="clearall"></div>';
		$('#designer_'+area+' .details').html(html).addClass('padded');
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

		this.updateDropdown('mirror');
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
		return JSON.parse(JSON.stringify(v));
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
			v = (this.choices.mirror ? this.copyValue(this.data.mirror[this.choices.mirror].risk) : 1);
			if(this.choices.deployablemirror && this.data.deployablemirror.risk) v = v*this.data.deployablemirror.risk;
			if(this.choices.uvmirror && this.data.uvmirror.risk) v = v*this.data.uvmirror.risk;
		}else if(choice=="cooling.cost"){
			v = (this.choices.cooling ? this.copyValue(this.choices.cooling.cost) : this.makeValue(0,'GBP'));
			v.value = -v.value;
		}else if(choice=="cooling.mass"){
			v = (this.choices.cooling ? this.copyValue(this.choices.cooling.mass) : this.makeValue(0,'kg'));
		}else if(choice=="cooling.time"){
			v = (this.choices.cooling ? this.copyValue(this.choices.cooling.time) : this.makeValue(0,'months'));
		}else if(choice=="satellite.cost"){
			v = (this.choices.mirror ? this.copyValue(this.data.mirror[this.choices.mirror].bus.cost) : this.makeValue(0,'GBP'));
			v.value = -v.value;
		}else if(choice=="satellite.mass"){
			v = (this.choices.mirror ? this.copyValue(this.data.mirror[this.choices.mirror].bus.mass) : this.makeValue(0,'kg'));
		}else if(choice=="satellite.time"){
			v = (this.choices.mirror ? this.copyValue(this.data.mirror[this.choices.mirror].bus.devtime) : this.makeValue(0,'months'));
		}else if(choice=="instruments.time"){
			v = this.makeValue(0,'months');
			if(this.choices.instruments){
				for(var i = 0; i < this.choices.instruments.length; i++){
					var t = this.convertValue(this.data.instrument.options[this.choices.instruments[i].type].devtime,'months');
					v.value += t.value;
				}
			}
		}else if(choice=="instruments.cost"){
			v = this.makeValue(0,'GBP');
			if(this.choices.instruments){
				for(var i = 0; i < this.choices.instruments.length; i++){
					var t = this.convertValue(this.data.wavelengths[this.choices.instruments[i].wavelength].cost,'GBP');
					v.value += t.value*this.data.instrument.options[this.choices.instruments[i].type].multiplier.cost;
				}
			}
			v.value = -v.value;
		}else if(choice=="instruments.mass"){
			v = this.makeValue(0,'kg');
			if(this.choices.instruments){
				for(var i = 0; i < this.choices.instruments.length; i++){
					var t = this.convertValue(this.data.wavelengths[this.choices.instruments[i].wavelength].mass,'kg');
					v.value += t.value*this.data.instrument.options[this.choices.instruments[i].type].multiplier.mass;
				}
			}
		}else if(choice=="site"){
			v = (this.choices.site ? this.phrases.designer.site.options[this.choices.site].label : '');
		}else if(choice=="site.prob"){
			v = (this.choices.site && this.data.site[this.choices.site].risk ? this.data.site[this.choices.site].risk : 1);
		}else if(choice=="vehicle"){
			v = (this.choices.vehicle ? this.phrases.designer.vehicle.options[this.choices.vehicle].label : '');
		}else if(choice=="vehicle.cost"){
			v = (this.choices.vehicle ? this.copyValue(this.data.vehicle[this.choices.vehicle].cost) : this.makeValue(0,'GBP'));
			v.value = -v.value;		
		}else if(choice=="vehicle.prob"){
			v = (this.choices.vehicle && this.data.vehicle[this.choices.vehicle].risk ? this.data.vehicle[this.choices.vehicle].risk : 1);
		}else if(choice=="ground.cost"){
			var m = this.choices.mission ? this.copyValue(this.data.mission[this.choices.mission].life) : this.makeValue(0,'months');
			v = this.copyValue(this.data.orbit.LEO.groundcost);
			v.value *= -this.convertValue(m,'years').value;	
		}else if(choice=="temperature"){
			v = this.makeValue(400,'K');
			if(this.choices.orbit) v = this.data.orbit[this.choices.orbit].temperature;
			if(this.choices.temperature){
				t = this.choices.temperature;
				if(t.value < v.value) v = t;
			}
		}else if(choice=="launch.cost"){
			v = (this.choices.vehicle ? this.copyValue(this.data.vehicle[this.choices.vehicle].cost) : this.makeValue(0,'GBP'));
			v.value *= -(this.choices.orbit ? this.data.orbit[this.choices.orbit].multiplier.launchcost : 1);
		}else if(choice=="orbit"){
			v = (this.choices.orbit) ? this.phrases.designer.orbit.options[this.choices.orbit].label : '';
		}else if(choice=="mission.time"){
			v = (this.choices.mission ? this.copyValue(this.data.mission[this.choices.mission].life) : this.makeValue(0,'months'));
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

	SpaceTelescope.prototype.updateSummary = function(){

		console.log('updateSummary')

		var html = '';
		var s = this.phrases.ui.summary;

		var prob = {};
		var cost = {};
		var mass = {};
		var time = {};
		var scie = {};
		var prof = {};

		prob.mirror = this.getChoice('mirror.prob');
		prob.site = this.getChoice('site.prob');
		prob.vehicle = this.getChoice('vehicle.prob');
		prob.cooling = 1;
		prob.instruments = 1;
		prob.mission = 1;
		prob.total = prob.site*prob.vehicle*prob.mirror*prob.cooling*prob.instruments*prob.mission;

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


		// Format times
		time.mirror = this.getChoice('mirror.time');
		time.satellite = this.getChoice('satellite.time');
		time.instruments = this.getChoice('instruments.time');
		time.cooling = this.getChoice('cooling.time');
		time.total = this.sumValues(time.mirror,time.satellite,time.cooling,time.instruments);
		time.mission = this.getChoice('mission.time');
		time.fuel = this.getChoice('fuel.time');

		// Format masses
		mass.mirror = this.getChoice('mirror.mass');
		mass.satellite = this.getChoice('satellite.mass');
		mass.cooling = this.getChoice('cooling.mass');
		mass.instruments = this.getChoice('instruments.mass');
		mass.total = this.sumValues(mass.mirror,mass.satellite,mass.cooling,mass.instruments);


		this.table.success.value = this.formatPercent(prob.total);
		if(this.data.site[this.choices.site] && this.data.site[this.choices.site].risk) this.table.success.list.success_site.value = this.formatPercent(prob.site);
		if(this.data.vehicle[this.choices.vehicle] && this.data.vehicle[this.choices.vehicle].risk) this.table.success.list.success_vehicle.value = this.formatPercent(prob.vehicle);
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
		this.updateTable('time_fuel','value',time.fuel);
		this.table.mass_total.value = mass.total;
		this.table.mass_total.list.mass_satellite.value = mass.satellite;
		this.table.mass_total.list.mass_mirror.value = mass.mirror;
		this.table.mass_total.list.mass_cooling_total.value = mass.cooling;
		if(this.settings.mode=="advanced"){
			this.table.mass_total.list.mass_cooling_total.list.mass_cooling_passive.value = this.makeValue(0,'kg');
			this.table.mass_total.list.mass_cooling_total.list.mass_cooling_cryo.value = this.makeValue(0,'kg');
			this.table.mass_total.list.mass_cooling_total.list.mass_cooling_active.value = this.makeValue(0,'kg');
		}
		this.table.mass_total.list.mass_instruments.value = mass.instruments;
		this.table.science_total.value = this.makeValue(0,'%');
		this.table.profile_total.list.profile_site.value = this.getChoice('site');
		this.table.profile_total.list.profile_vehicle.value = this.getChoice('vehicle');
		this.table.profile_total.list.profile_instruments.value = (this.choices.instruments) ? this.choices.instruments.length : 0;
		this.table.profile_total.list.profile_temperature.value = this.getChoice('temperature');
		this.table.profile_total.list.profile_orbit.value = this.getChoice('orbit');
		var d = new Date();
		var t = this.convertValue(time.total,'months');
		d.setUTCMonth(d.getUTCMonth()+t.value);
		this.table.profile_total.list.profile_launch.value = d.toDateString();
		t = this.convertValue(time.mission,'months');
		t2 = this.convertValue(time.fuel,'months');
		if(t2.value < t.value) t = t2;
		d.setUTCMonth(d.getUTCMonth()+t.value);
		this.table.profile_total.list.profile_end.value = d.toDateString();

		this.updateSummaryList();

		return this;
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
	

	function getPrecision(v){
		if(v < 1e-9) return 1;
		if(typeof v==="number" && v < 1) return Math.ceil(Math.log10(1/v))+1;
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
			var val = (v.value).toFixed(p).replace(/\.0+$/,'').replace(/(\.[1-9]+)0+$/,"$1");
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
		var p = Math.floor(Math.log10(v));
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

	SpaceTelescope.prototype.parseChoices = function(view,e){

console.log('parseChoices')
		//this.choices = {};
		var l,m,d,u,c,t,v,s;
		this.errors = [];
		this.warnings = [];
		
		// Process mission
		l = $('#mission_duration').val();
		if(l && this.data.mission[l]) this.choices.mission = l;
		else this.choices.mission = "";
		
		// Process satellite
		m = $('#mirror_diameter').val();
		if(m && this.data.mirror[m]) this.choices.mirror = m;
		else this.choices.mirror = "";
		

		d = $('input[name=toggledeployable]:checked').val();
		if(d) this.choices.deployablemirror = (d=="yes" ? true : false);
		else this.choices.deployablemirror = false;
		u = $('input[name=toggleuv]:checked').val();
		if(u) this.choices.uvmirror = (u=="yes" ? true : false);
		else this.choices.uvmirror = false;


		// Process instruments
		var cost = this.makeValue(0,'GBP');
		var mass = this.makeValue(0,'kg');
		var temp = this.makeValue(0,'K');
		var time = this.makeValue(0,'months');
		if(!this.choices.instrument) this.choices.instrument = {};
		if(this.choices.instruments){
			var uv = false;
			for(var i = 0; i < this.choices.instruments.length; i++){
				var w = this.data.wavelengths[this.choices.instruments[i].wavelength];
				var t = this.data.instrument.options[this.choices.instruments[i].type];
				if(!t.multiplier) t.multiplier = { };
				if(!t.multiplier.cost) t.multiplier.cost = 1;
				if(!t.multiplier.mass) t.multiplier.mass = 1;

				if(w.cost) cost = this.sumValues(cost,w.cost*t.multiplier.cost);
				if(w.mass) mass = this.sumValues(mass,w.mass*t.multiplier.mass);
				if(t.devtime) time = this.sumValues(time,t.devtime);

				if(this.choices.instruments[i].wavelength=="uv") uv = true;
			}
			var slots = (this.choices.mirror) ? this.data.mirror[this.choices.mirror].bus.instrumentslots : 0;
			if(this.choices.instruments.length > slots) this.errors.push({ 'text': this.phrases.errors.slots, 'link': '#designer_instruments' });

			if(!this.choices.uvmirror && uv)  this.warnings.push({ 'text': this.phrases.warnings.uv, 'link': '#designer_satellite' });

		}
		this.choices.instrument.cost = cost;
		this.choices.instrument.mass = mass;
		this.choices.instrument.temp = temp;
		this.choices.instrument.time = time;


		// Process cooling
		c = $('input[name=hascooling]:checked').val();
		this.choices.temperature = this.makeValue(400,'K'); // get from orbit
		this.choices.cooling = {
			"cost": this.makeValue(0,'GBP'),
			"mass": this.makeValue(0,'kg'),
			"life": this.makeValue(0,'months'),
			"time": this.makeValue(0,'months'),
			"risk": this.makeValue(100,'%')
		}
		if(c){
			if(c=="yes"){
				if($('#cooling_temperature').length > 0){
					t = this.data.cooling.temperature[$('#cooling_temperature').val()];
					if(t.temperature) this.choices.temperature = t.temperature;
					
					if(t.mass) this.choices.cooling.mass = t.mass;
					if(t.cost) this.choices.cooling.cost = t.cost;
					if(t.devtime) this.choices.cooling.time = t.devtime;
					if(t.life) this.choices.cooling.life = t.life;
					if(t.risk) this.choices.cooling.risk = t.risk;

					if(this.choices.mirror && this.data.mirror[m]['passive']){
						this.choices.cooling.mass = this.sumValues(this.choices.cooling.mass,this.data.mirror[m]['passive'].mass);
						this.choices.cooling.cost = this.sumValues(this.choices.cooling.cost,this.data.mirror[m]['passive'].cost);
						this.choices.cooling.time = this.sumValues(this.choices.cooling.time,this.data.mirror[m]['passive'].devtime);
					}
				}
			}
		}

		
		// Process vehicle
		v = $('#designer_vehicle input[name=vehicle_rocket]:checked').val();
		if(v && this.data.vehicle[v]) this.choices.vehicle = v;
		else this.choices.vehicle = "";

		// Process site
		s = $('#site').val();
		var ok = false;
		if(s){
			this.choices.site = s;
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
		}else this.choices.site = "";

		// Process orbit
		var o = $('#mission_orbit').val();
		if(o && this.data.orbit[o]){
			this.choices.orbit = o;
			ok = false;
			if(this.choices.site){
				ok = this.data.site[this.choices.site].orbits[o];
			}else{
				// No site chosen so the site is actually OK
				ok = true;
			}
			if(!ok) this.errors.push({ 'text': this.phrases.errors.orbit.replace(/%SITE%/g,this.phrases.designer.site.options[s].label).replace(/%ORBIT%/,this.phrases.designer.orbit.options[o].label), 'link': '#designer_orbit' });
		}else this.choices.orbit = "";

		return this;
	}

	SpaceTelescope.prototype.updateChoices = function(){
console.log('updateChoices')
		this.updateMessages("error",this.errors);
		this.updateMessages("warning",this.warnings);
		this.updateSummary();

		return this;
	}

	SpaceTelescope.prototype.updateMessages = function(category,e){

console.log('updateMessages',e)
		if(category != "error" && category != "warning") return this;

		var li = '';
		var v = 0;
		if(e && typeof e=="object" && e.length > 0){
			v = e.length;
			for(var i = 0 ; i < e.length; i++) li += '<li>'+e[i].text+' <a href="'+e[i].link+'">'+this.phrases.ui[category].link+'</a></li>';
		}
		
		// Update the values
		$('.'+category+'.value').html(v);
		$('#messages h3.'+category).next().html(li);

		// Toggle if there are no messages in this category
		if(v == 0) $('.toggle'+category+',.'+category+'s').hide();
		else $('.toggle'+category+',.'+category+'s').show();
		
		return this;
	}

	SpaceTelescope.prototype.test = function(){
		$('#scenarios .button').eq(1).trigger('click');
		location.href = '#designer_objectives';

		$('#mirror_diameter').val('1.0m').trigger('change');
		$('#cooling_yes').attr('checked',true);
		$('#cooling_temperature').val('100K').trigger('change');
		$('#vehicle_rocket_SOYZ').trigger('click');
		$('.launchsite.KSC').trigger('click');
		$('#mission_orbit').val('LEO').trigger('change');
		$('#mission_duration').val('4');

		this.parseChoices().updateChoices();

		return this;
	}
	
	SpaceTelescope.prototype.toggleView = function(view,e){

		console.log('toggleView',view)

		if(!$('#'+view).is(':visible')) this.showView(view,e);
		else this.showView(e);

		return this;
	}

	SpaceTelescope.prototype.showView = function(view,e){

		console.log('showView',view,e)

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

		// Check which stage we are at and stop people seeing the designer if they haven't picked a scenario yet
		if(this.stage=="intro"){
			if(this.scenario){
				view = "designer";
			}else{
				// If we are on the introduction we can't skip ahead to the designer section before we've chosen a scenario
				if(view.indexOf('designer')==0) view = "scenarios";
			}
		}else if(this.stage=="scenarios"){
			if(this.scenario) view = "designer";
			else{
				// We can't go back to the introduction
				if(view.indexOf('intro')==0) view = "scenarios";
			}
		}else if(this.stage=="designer"){
			// We can't go backwards
			if(view.indexOf('scenarios')==0 || view.indexOf('intro')==0) view = "designer";
		}

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
				this.makeSpace().displayOrbits();

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
		}else if(view=="scenarios"){
			$('#summaryext').hide();
			$('#scenarios').show();
			this.updateBodyClass('showscenarios');
			this.stage = "scenarios";
		}else{
			$('#'+this.stage).show();
			this.updateBodyClass('show'+this.stage);
		}

		if(this.pushstate && !e) history.pushState({},"Guide","#"+view);

		return this;
	}

	SpaceTelescope.prototype.setScroll = function(el){
console.log('setScroll',el)
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

		console.log('toggleGuide',key)
		if(typeof key==="object"){
			e = key;
			key = "";
		}

		if(!$('#guide').is(':visible')){
			if(!key) key = "guide";
			this.showView(key);
		}else{
			this.showView();
		}

		return this;
	}

	SpaceTelescope.prototype.closeGuide = function(){
		console.log('closeGuide')
		$('body').removeClass('showguide');
		$('#guide').hide();
		$('#intro').show();
		return this;
	}

	SpaceTelescope.prototype.showGuide = function(key){

		console.log('showGuide',key)
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
						for(i in this.data.instrument){
							if(i != "none"){
								table += '<tr>';
								table += '<td>'+this.phrases.designer.instruments.options[i].label+'</td>';
								table += '<td>'+this.formatValue(this.data.instrument[i].mass)+'</td>';
								table += '<td>'+this.formatValue(this.data.instrument[i].cost)+'</td>';
								table += '<td>'+this.formatValue(this.data.instrument[i].devtime)+'</td>';
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

			if(html.indexOf('script')>= 0 && MathJax) MathJax.Hub.Queue(["Typeset",MathJax.Hub,'guide']);

			// Add events to guide close
			this.addCloser($('#guide'),{me:this},function(e){ e.preventDefault(); e.data.me.toggleGuide(); });

			var _obj = this;
			$('#guide').show(function(){ _obj.setScroll('#'+origkey); });
			$('#intro').hide();
	
		}else{
			this.closeGuide();		
		}

		$('#guide').show().find('a').eq(0).focus();
		this.updateBodyClass('showguide');

		return this;
	}

	SpaceTelescope.prototype.updateBodyClass = function(cls){
		$('body').removeClass('showguide showintro showoptions showmessages').addClass(cls);
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

	// Add commas to separate thousands	
	function addCommas2(v){
		var str = "";
		var v2;
		if(typeof v==="string") v = parseFloat(v,10)
		if(v < 1000) return ''+v;
		while(v > 1000){
			v2 = (v - Math.floor(v/1000)*1000);
			if(v2 < 100) v2 = "0"+v2;
			if(v2 < 10) v2 = "0"+v2;
			if(str) str = ","+str;
			str = ''+v2+''+str;
			v = (v - v2)/1000;
		}
		if(str!="") str = ','+str;
		if(v > 0) str = v+str;
		return str;
	}

	// Helper functions
	function htmlDecode(input){
		return $('<div />').html(input).text();
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
	function centre(lb){
		var wide = $(window).width();
		var tall = $(window).height();
		var l = 0;
		var t = 0;
		if(lb.css('max-width').indexOf('px') > 0){
			l = ((wide-lb.outerWidth())/2);
			lb.css({left:((wide-lb.outerWidth())/2)+'px'});
			if($(window).height() > lb.height()){
				//t = (window.scrollY+(tall-lb.outerHeight())/2);
				t = ((tall-lb.outerHeight())/2 + $(window).scrollTop());
				$('body').css('overflow-y','hidden');
			}
		}
		lb.css({left:l+"px",top:t+'px','position':'absolute'});
	}

	function makeYouTubeEmbed(video){
		if(!video.url) return "";
		video.url = video.url.replace(/watch\?v=/,'embed/');
		if(video.start && typeof video.start==="number"){
			//video.start -= 12;
			//if(video.start < 0) video.start = 0;
			video.url += '?start='+video.start;
			if(video.end && typeof video.end==="number") video.url += '&end='+video.end;
		}
		video.url += (video.url.indexOf('?')>0 ? "&" : "?")+"rel=0";//&autoplay=1";	// Don't show related videos at the end
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
