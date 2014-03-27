/*!
	SpaceTelescope
	(c) Stuart Lowe, Chris North 2013/2014
*/
/*
	USAGE:
		<script src="js/jquery-1.10.0.min.js" type="text/javascript"></script>
		<script src="js/spacetelescopedesigner.js" type="text/javascript"></script>
		<script type="text/javascript">
		<!--
			$(document).ready(function(){
				audible = $.spacetelescopedesigner({});
			});
		// -->
		</script>
		
	OPTIONS (default values in brackets):
*/

if(typeof $==="undefined") $ = {};

(function($) {


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
	

	// Control and generate the sound.
	function SpaceTelescope(inp){
	
		// Error checking for jQuery
		if(typeof $!=="function"){
			console.log('No jQuery! Abort! Abort!');
		}

		this.q = $.query();
		this.i = inp;

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
		$('a.togglewarnings,a.toggleerrors').on('click',{me:this},function(e){ e.preventDefault(); e.data.me.toggleMenus('messages'); });
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

		if(this.pushstate){
			var _obj = this;
			window.onpopstate = function(e){ _obj.navigate(e); };
		}

		// Make sure the menu stays attached to the menu bar (unless scrolling down)
		$(document).on('scroll',{me:this},function(e){ e.data.me.scrollMenus(); });

		//$('.dropdown li:last-child a').on('blur',{me:this},function(e){ console.log('Blur'); e.data.me.toggleMenus(); });

		$('.scriptonly').removeClass('scriptonly');
		
		$(window).resize({me:this},function(e){ e.data.me.resize(); });

		return this;
	}

	SpaceTelescope.prototype.buildPage = function(){

		console.log('buildPage')

		// Designer sections
		var sections = ['objectives','satellite','instruments','cooling','vehicle','site','orbit','proposal'];

		// Add containers for each designer section
		for(var i = 0; i < sections.length; i++){
			if($('#designer_'+sections[i]).length == 0) $('#output').append('<div id="designer_'+sections[i]+'" class="designer"><h2 class="designer_title"><a href="#designer_'+sections[i]+'" class="toggle'+sections[i]+'"></a></h2><div class="designer_content"><div class="about"></div><div class="options"></div><div class="questions"></div></div></div>');
		}
		var html = '';
		// Build menu item for each designer section
		for(var i = 0; i < sections.length; i++) html += '<li><a href="#designer_'+sections[i]+'" class="toggle'+sections[i]+'"></a></li>';
		$('#menubar').html('<ul>'+html+'</ul>')


		// Build the satellite section
		$('#designer_satellite .options').html('<form><ul class="padded"><li class="option mirror_diameter"><label for="mirror_diameter"></label><select id="mirror_diameter" name="mirror_diameter"></select></li><li class="option mirror_deployable"><label for="mirror_deployable"></label><input id="mirror_deployable" name="mirror_deployable" type="checkbox" /></li><li class="option mirror_uv"><label for="mirror_uv"></label><input id="mirror_uv" name="mirror_uv" type="checkbox" /></li></ul></form>');

		// Build the instruments section
		$('#designer_instruments .options').html('<form><ul class="padded"><li><label for="instruments"></label><select id="instruments" name="instruments"></select> <input type="text" id="instrument_name" name="instrument_name" /><a href="#" class="add_instrument"><img src="images/cleardot.gif" class="icon add" /></a></li></ul></form>');

		// Build cooling options
		$('#designer_cooling .options').html('<form><ul class="padded"><li><label for="cooling"></label><select id="cooling" name="cooling"></select></li></ul></form>');

		// Update the launch vehicle section
		html = '<div class="images"></div>'
		html += '<form><ul class="padded">';
		for(var l in this.data.rocket){
			html += '<li><div class="rocket"></div><div class="operator"><img src="" alt="" title="" /></div>';
			html += '<div class="height"><strong></strong> <span class="value"></span></div>';
			html += '<div class="diameter"><strong></strong> <span class="value"></span></div>';
			html += '<div class="currency"><strong></strong> <span class="value"></span></div>';
			// Are we in basic or advanced mode?
			if(this.data.rocket[l].mass.value) html += '<div class="mass"><strong></strong> <span class="value"></span></div>';
			else html += '<div class="massLEO"><strong></strong> <span class="value"></span></div><div class="massGTO"><strong></strong> <span class="value"></span></div>';

			if(this.data.rocket[l].risk) html += '<div class="risk"><strong></strong> <span class="value"></span></div>'
			html += '<div class="sites"><strong></strong> <br /><span class="value"></span></div>'
			html += '<input type="radio" name="vehicle_rocket" /><a href="#" class="button"></a></li>';
		}
		html += "</ul></form>";
		$('#designer_vehicle .options').html(html);
		$('#designer_vehicle .options .button').on('click',{me:this},function(e){
			e.preventDefault();
			$(this).parent().parent().find('li').removeClass('selected');
			$(this).parent().addClass('selected').find('input').trigger('click');
		});

		// Build proposal document holder
		$('#designer_proposal .options').html('<div class="padded"><div class="doc"></div></div>');

		return this;
	}
	
	SpaceTelescope.prototype.resize = function(){

		if(this.modal){
			this.positionModal(this.modal);
		}
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
		if(!event) event = { altKey: false };
		for(var i = 0 ; i < this.keys.length ; i++){
			if(this.keys[i].charCode == charCode && event.altKey == this.keys[i].altKey){
				this.keys[i].fn.call(this,{event:event});
				break;
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
		$.ajax({
			url: url,
			method: 'GET',
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


	// Update the page using the JSON response
	SpaceTelescope.prototype.update = function(){

		console.log('update')

		if(!this.phrases || !this.data) return this;

		this.buildPage();

		this.updateLanguage();

		$('#language.dropdown').hide()
		
		// Is this the first time we've called this function since page load?
		if(!this.loaded){
			// Executed on page load with URL containing an anchor tag.
			this.navigate();
			this.loaded = true;
		}
		
		return this;
	}

	// Update the text of a specific dropdown select box
	// TODO: Keep selected
	SpaceTelescope.prototype.updateDropdown = function(dropdown){

		var options = "";
		var el;
		if(dropdown=="mirror"){
			el = $('#mirror_diameter');
			for(var m in this.data.mirror) options += '<option>'+this.formatValue(this.data.mirror[m].diameter)+' ('+this.formatValue(this.data.mirror[m].cost)+')</option>';
			el.html(options);
		}else if(dropdown=="instruments"){
			el = $('#instruments');
			for(var m in this.data.instrument.options) options += '<option>'+this.phrases.designer.instrument.options.instrument[m].label+(this.data.instrument.options[m].cost ? ' ('+this.formatValue(this.data.instrument.options[m].cost)+')' : '')+'</option>';
			el.html(options);
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
		$('#designer_objectives .options').html('')

		// Update the satellite section
		$('#designer_satellite .options .mirror_diameter label').html(d.designer.satellite.options.diameter.label)
		this.updateDropdown('mirror');
		$('#designer_satellite .options .mirror_deployable label').html(d.designer.satellite.options.deployable.label);
		$('#designer_satellite .options .mirror_uv label').html(d.designer.satellite.options.uv.label);
		if(d.designer.satellite.about) $('#designer_satellite .about').html('<div class="padded">'+d.designer.satellite.about+'</div>');

		// Update the launch vehicle section
		i = 0;
		rk = d.designer.rocket;
		var imgs = "";
		var n = 0;
		for(var l in this.data.rocket) n++;
		var w = 100/n;
		for(var l in this.data.rocket){
			li = $('#designer_vehicle .options li').eq(i);
			r = this.data.rocket[l];
			imgs += '<div style="display:inline-block;width:'+w+'%;"><img src="'+r.img+'" alt="'+rk.options[l].label+'" title="'+rk.options[l].label+'"  style="width:100%;" /><br /><img src="'+this.data.operator[r.operator].img+'" alt="'+d.operator[r.operator].label+'" title="'+d.operator[r.operator].label+'" style="max-width:100%;" /></div>';
			li.find('.rocket').html(rk.options[l].label);
			li.find('.operator img').attr({'src':this.data.operator[r.operator].img,'alt':d.operator[r.operator].label, 'title':d.operator[r.operator].label});
			if(r.height){
				li.find('.height strong').html(rk.height);
				this.updateValue(li.find('.height .value'),r.height);
			}
			li.find('.diameter strong').html(rk.diameter);
			this.updateValue(li.find('.diameter .value'),r.diameter);
			li.find('.currency strong').html(rk.cost);
			this.updateValue(li.find('.currency .value'),r.cost);
			// Are we in basic or advanced mode?
			if(r.mass.value){
				li.find('.mass strong').html(rk.massLEO);
				this.updateValue(li.find('.mass .value'),r.mass);
			}else{
				li.find('.massLEO strong').html(rk.massLEO);
				this.updateValue(li.find('.massLEO .value'),r.massLEO);
				li.find('.massGTO strong').html(rk.massGTO);
				this.updateValue(li.find('.massGTO .value'),r.massGTO);
			}
			if(r.risk){
				li.find('.risk strong').html(rk.risk);
				this.updateValue(li.find('.risk .value'),r.risk);
			}
			li.find('.sites strong').html(rk.sites);
			html = '';
			for(var s = 0; s < r.sites.length; s++) html += ''+d.designer.site.options[r.sites[s]].label+'<br />';
			this.updateValue(li.find('.sites .value'),html);

			li.find('input').attr('value',l);
			li.find('.button').html(rk.select);
			
			i++;
		}
		$('#designer_vehicle .options .images').html('<div class="padded" style="text-align:center;">'+imgs+'</div>');
		if(d.designer.rocket.about) $('#designer_vehicle .about').html('<div class="padded">'+d.designer.rocket.about+'</div>');

		// Update the instruments section
		// TODO: update selected
		this.updateDropdown('instruments');
		$('#designer_instruments .options label').html(d.designer.instrument.options.label);
		$('#designer_instruments .options input#instrument_name').attr('placeholder',d.designer.instrument.options.name);
		$('#designer_instruments .options a.add_instrument').attr('title',d.designer.instrument.options.add);
		if(d.designer.instrument.about) $('#designer_instruments .about').html('<div class="padded">'+d.designer.instrument.about+'</div>');

		// Update the cooling section
		// TODO: update selected
		html = "";
		for(var m in this.data.cooling) html += '<option value="'+m+'">'+this.formatValue(this.data.cooling[m].temperature)+'</option>';
		$('#designer_cooling .options select').html(html);
		$('#designer_cooling .options label').html(d.designer.cooling.options.label);
		if(d.designer.cooling.about) $('#designer_cooling .about').html('<div class="padded">'+d.designer.cooling.about+'</div>');

		// Update the proposal section
		$('#designer_proposal .options .doc').html(d.designer.proposal.doc.replace(/%FUNDER%/g,'Funder').replace(/%DATE%/,(new Date()).toDateString()).replace(/%TO%/,'<input type="text" name="proposal_to" id="proposal_to" value="" >').replace(/%NAME%/,'<input type="text" name="proposal_name" id="proposal_name" value="" >').replace(/%AIM%/,'<textarea name="proposal_aim" id="proposal_aim"></textarea>').replace(/%PREVIOUS%/,'<input type="text" name="proposal_previous" id="proposal_previous" value="" >').replace(/%ADVANCE%/,'<textarea name="proposal_advance" id="proposal_advance"></textarea>').replace(/%INSTRUMENTS%/,'<textarea name="proposal_instruments" id="proposal_instruments"></textarea>').replace(/%GOALS%/,'<textarea name="proposal_goal" id="proposal_goal"></textarea>').replace(/%RESLOW%/,'<input type="text" name="proposal_reslow" id="proposal_reslow" value="" >').replace(/%RESHIGH%/,'<input type="text" name="proposal_reshigh" id="proposal_reshigh" value="" >').replace(/%MIRROR%/,'<input type="text" name="proposal_mirror" id="proposal_mirror" value="" >').replace(/%REQTEMPERATURE%/,'<input type="text" name="proposal_reqtemp" id="proposal_reqtemp" value="" >').replace(/%TEMPERATURE%/,'<input type="text" name="proposal_temp" id="proposal_temp" value="" >').replace(/%MASS%/,'<input type="text" name="proposal_mass" id="proposal_mass" value="" >').replace(/%MASSSATELLITE%/,'<input type="text" name="proposal_mass_satellite" id="proposal_mass_satellite" value="" >').replace(/%MASSMIRROR%/,'<input type="text" name="proposal_mass_mirror" id="proposal_mass_mirror" value="" >').replace(/%MASSCOOLING%/,'<input type="text" name="proposal_mass_cooling" id="proposal_mass_cooling" value="" >').replace(/%MASSINSTRUMENTS%/,'<input type="text" name="proposal_mass_instruments" id="proposal_mass_instruments" value="" >').replace(/%ORBIT%/,'<input type="text" name="proposal_orbit" id="proposal_orbit" value="" >').replace(/%DISTANCE%/,'<input type="text" name="proposal_distance" id="proposal_distance" value="" >').replace(/%PERIOD%/,'<input type="text" name="proposal_period" id="proposal_period" value="" >').replace(/%FUEL%/,'<input type="text" name="proposal_fuel" id="proposal_fuel" value="" >').replace(/%DURATION%/,'<input type="text" name="proposal_duration" id="proposal_duration" value="" >').replace(/%VEHICLE%/,'<input type="text" name="proposal_vehicle" id="proposal_vehicle" value="" >').replace(/%OPERATOR%/,'<input type="text" name="proposal_operator" id="proposal_operator" value="" >').replace(/%SITE%/,'<input type="text" name="proposal_site" id="proposal_site" value="" >').replace(/%LAUNCHMASS%/,'<input type="text" name="proposal_launchmass" id="proposal_launchmass" value="" >').replace(/%COST%/,'<input type="text" name="proposal_cost" id="proposal_cost" value="" >').replace(/%COSTSATELLITE%/,'<input type="text" name="proposal_cost_satellite" id="proposal_cost_satellite" value="" >').replace(/%COSTMIRROR%/,'<input type="text" name="proposal_cost_mirror" id="proposal_cost_mirror" value="" >').replace(/%COSTCOOLING%/,'<input type="text" name="proposal_cost_cooling" id="proposal_cost_cooling" value="" >').replace(/%COSTINSTRUMENTS%/,'<input type="text" name="proposal_cost_instruments" id="proposal_cost_instruments" value="" >').replace(/%COSTDEV%/,'<input type="text" name="proposal_cost_dev" id="proposal_cost_dev" value="" >').replace(/%COSTLAUNCH%/,'<input type="text" name="proposal_cost_launch" id="proposal_cost_launch" value="" >').replace(/%COSTGROUND%/,'<input type="text" name="proposal_cost_ground" id="proposal_cost_ground" value="" >').replace(/%COSTOPERATIONS%/,'<input type="text" name="proposal_cost_operations" id="proposal_cost_operations" value="" >'));

		// Update designer toggle buttons
		$('.toggleobjectives').text(d.designer.objectives.label).attr('title',d.designer.objectives.help);
		$('.togglesatellite').text(d.designer.satellite.label).attr('title',d.designer.satellite.help);
		$('.toggleinstruments').text(d.designer.instrument.label).attr('title',d.designer.instrument.help);
		$('.togglecooling').text(d.designer.cooling.label).attr('title',d.designer.cooling.help);
		$('.togglevehicle').text(d.designer.rocket.label).attr('title',d.designer.rocket.help);
		$('.togglesite').text(d.designer.site.label).attr('title',d.designer.site.help);
		$('.toggleorbit').text(d.designer.orbit.label).attr('title',d.designer.orbit.help);
		$('.toggleproposal').text(d.designer.proposal.label).attr('title',d.designer.proposal.help);

		// Update menu items
		$('.togglemenu').attr('title',d.ui.menu.title);
		$('#menu ul li').each(function(i){
			var id = $(this).attr('data');
			$(this).find('a').attr('title',d.ui.menu[id].title).find('span').html(d.ui.menu[id].label)
		})

		$('.togglewarnings').attr('title',d.ui.warnings.title);
		$('.toggleerrors').attr('title',d.ui.errors.title);
		$('.togglesuccess').attr('title',d.ui.summary.success.title);
		$('.toggletime').attr('title',d.ui.summary.time.title);
		$('.togglecost').attr('title',d.ui.summary.cost.title);
		$('.togglemass').attr('title',d.ui.summary.mass.title);
		$('.togglescience').attr('title',d.ui.summary.science.title);

		// Update introduction text
		$('#introduction').html(d.intro);
		$('#introduction').append('<div class="centre"><a href="#scenarios" class="button fancybtn">Choose a mission<!--LANGUAGE--></a></div>');
		$('#introduction .button').on('click',{me:this},function(e){ e.data.me.showView('scenarios',e); });

		var li = '';
		var txt = '';
		for(var i = 0; i < this.scenarios.length; i++){
			txt = (typeof this.scenarios[i].description==="string") ? this.scenarios[i].description : "";
			li += '<li><div class="padded"><h3>'+this.scenarios[i].name+'</h3><p>'+txt.replace(/%COST%/,'<span class="convertable" data-value="'+this.scenarios[i].budget.value+'" data-units="'+this.scenarios[i].budget.units+'" data-dimension="'+this.scenarios[i].budget.dimension+'">'+this.formatValue(this.scenarios[i].budget)+'</span>')+'</p><a href="#" class="button" title="'+this.scenarios[i].name+'">Choose this mission<!--LANGUAGE--></a></div></li>'
		}
		$('#scenariolist').html(li);
		if($('#scenariolist h2').length==0) $('#scenariolist').before('<h2><!--LANGUAGE-->Choose a mission</h2>');
		
		// Update values to be consistent with current user preferences
		this.updateUnits();

		return this;
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
			$('form#optionform #change'+o).on('change',{me:this,o:o},function(e){ e.data.me.settings[e.data.o] = $(this).val(); console.log(e.data.o,e.data.me.settings[e.data.o]); e.data.me.updateUnits(); });
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
		return this;
	}

	// Update all values shown in the DOM
	SpaceTelescope.prototype.updateValues = function(){

		this.updateValue('cost_available',{value:2000-320,units:'GBP',dimension:'currency'});
		this.updateValue('cost_initial',{value:2000,units:'GBP',dimension:'currency'});
		this.updateValue('cost_dev_total',{value:-250,units:'GBP',dimension:'currency'});
		this.updateValue('cost_dev_satellite',{value:80,units:'GBP',dimension:'currency'});
		this.updateValue('cost_dev_mirror',{value:100,units:'GBP',dimension:'currency'});
		this.updateValue('cost_dev_cooling',{value:20,units:'GBP',dimension:'currency'});
		this.updateValue('cost_dev_instruments',{value:50,units:'GBP',dimension:'currency'});
		this.updateValue('cost_operations_total',{value:-70,units:'GBP',dimension:'currency'});
		this.updateValue('cost_operations_launch',{value:50,units:'GBP',dimension:'currency'});
		this.updateValue('cost_operations_ground',{value:10,units:'GBP',dimension:'currency'});
		this.updateValue('cost_total',{value:-320,units:'GBP',dimension:'currency'});
		this.updateValue('mass_total',{value:1050,units:'kg',dimension:'mass'});
		this.updateValue('success_total','89%');
		this.updateValue('time_dev_total',{value:38,units:'months',dimension:'time'});
		this.updateValue('time_dev_satellite',{value:6,units:'months',dimension:'time'});
		this.updateValue('time_dev_mirror',{value:8,units:'months',dimension:'time'});
		this.updateValue('time_dev_cooling',{value:12,units:'months',dimension:'time'});
		this.updateValue('time_dev_instruments',{value:12,units:'months',dimension:'time'});
		this.updateValue('science_total','78%');

		return this;
	}
	
	SpaceTelescope.prototype.updateValue = function(key,value){
		var el;
		if(typeof key==="object") el = key;
		else if(typeof key==="string") el = $('.'+key+'.value');

		if(el.length > 0){
			if(typeof value==="object") el.attr({'data-value':value.value,'data-units':value.units,'data-dimension':value.dimension}).html(this.formatValue(value));
			else el.html(value);
		}
		return this;
	}

	SpaceTelescope.prototype.formatValueSpan = function(value,key){
		key = (key) ? " "+key : "";
		return (typeof value==="object" ? '<span class="value'+key+' convertable" data-value="'+value.value+'" data-units="'+value.units+'" data-dimension="'+value.dimension+'">'+this.formatValue(value)+'</span>' : '<span class="value">'+value+'</span>');
	}
	
	SpaceTelescope.prototype.processSummaryList = function(list,key,depth){
		depth++;
		var html = '<ul class="summary">';
		for(var i = 0; i < list.length; i++){
			html += '<li>';
			if(list[i].key && list[i].value) html += '<span class="label '+list[i].key+'">'+list[i].label+'</span>'+this.formatValueSpan(list[i].value,key+' '+list[i].key);
			if(list[i].list) html += this.processSummaryList(list[i].list,(depth==1 ? key : ''));
			html += '</li>';
		}
		html += '</ul>';
		return html;
	}
	
	SpaceTelescope.prototype.updateSummaryList = function(table){

		var html = '';
		var key = table.key;
		if(key.indexOf('_') > 0) key = key.substr(0,key.indexOf('_'));
		var keys = key;
		if(key!=table.key) keys += ' '+table.key;
		var depth = 0;
		if(typeof key==="string"){
			html += '<h3><img src="images/cleardot.gif" class="icon '+keys+'" /> <span class="label '+keys+'">'+table.title+'</span> '+this.formatValueSpan(table.value,keys)+'</h3>';
			html += this.processSummaryList(table.list,key,depth);
			html = '<div class="padded">'+html+'</div>';
			// Update summary bar items
			this.updateValue('baritem .'+table.key,table.value);
			$('#summaryext_'+key).html(html);
		}
		return this;
	}

	SpaceTelescope.prototype.updateSummary = function(){

console.log('updateSummary')
		var html = '';
		var s = this.phrases.ui.summary;

		// Update success items
		var table = [{
			"key": "success",
			"value": "20%",
			"title": s.success.title,
			"list": [{
				'key': 'success_site',
				'label': s.success.site,
				'value': '98%'
			},{ 
				'key': 'success_vehicle',
				'label': s.success.vehicle,
				'value': '98%'
			},{ 
				'key': 'success_deploy',
				'label': s.success.deploy,
				'value': '98%'
			},{ 
				'key': 'success_cooling',
				'label': s.success.cooling,
				'value': '98%'
			},{ 
				'key': 'success_instruments',
				'label': s.success.instruments,
				'value': '98%'
			},{ 
				'key': 'success_mission',
				'label': s.success.mission,
				'value': '99%'
			}]
		},{
			"key": "cost_available",
			"value": { 'value': 1740, 'units': 'GBP', 'dimension': 'currency' },
			"title": s.cost.title,
			"list": [{
				'key': 'cost_initial',
				'label': s.cost.initial,
				'value': { 'value': 2000, 'units': 'GBP', 'dimension': 'currency' }
			},{
				'key': 'cost_dev_total',
				'label': s.cost.dev.title,
				'value': { 'value': -200, 'units': 'GBP', 'dimension': 'currency' },
				'list': [{
					'key': 'cost_dev_satellite',
					'label': s.cost.dev.satellite,
					'value': { 'value': 0, 'units': 'GBP', 'dimension': 'currency' }
				},{
					'key': 'cost_dev_mirror',
					'label': s.cost.dev.mirror,
					'value': { 'value': 0, 'units': 'GBP', 'dimension': 'currency' }
				},{
					'key': 'cost_dev_cooling',
					'label': s.cost.dev.cooling,
					'value': { 'value': 0, 'units': 'GBP', 'dimension': 'currency' }
				},{
					'key': 'cost_dev_instruments',
					'label': s.cost.dev.instruments,
					'value': { 'value': 0, 'units': 'GBP', 'dimension': 'currency' }
				}]
			},{
				'key': 'cost_operations_total',
				'label': s.cost.operations.title,
				'value': { 'value': -60, 'units': 'GBP', 'dimension': 'currency' },
				'list': [{
					'key': 'cost_operations_launch',
					'label': s.cost.operations.launch,
					'value': { 'value': -50, 'units': 'GBP', 'dimension': 'currency' }
				},{
					'key': 'cost_operations_ground',
					'label': s.cost.operations.ground,
					'value': { 'value': -10, 'units': 'GBP', 'dimension': 'currency' }
				}]
			},{
				'key': 'cost_total',
				'label': s.cost.total,
				'value': { 'value': -260, 'units': 'GBP', 'dimension': 'currency' }
			},{
				'key': 'cost_available',
				'label': s.cost.available,
				'value': { 'value': 1740, 'units': 'GBP', 'dimension': 'currency' }
			}]
		},{
			"key": "time_dev_total",
			"value": { 'value': 19, 'units': 'months', 'dimension': 'time' },
			"title": s.time.title,
			"list": [{
				'key': 'time_dev_total',
				'label': s.time.dev.title,
				'value': { 'value': 19, 'units': 'months', 'dimension': 'time' },
				'list': [{
					'key': 'time_dev_satellite',
					'label': s.time.dev.satellite,
					'value': { 'value': 5, 'units': 'months', 'dimension': 'time' }
				},{
					'key': 'time_dev_mirror',
					'label': s.time.dev.mirror,
					'value': { 'value': 6, 'units': 'months', 'dimension': 'time' }
				},{
					'key': 'time_dev_cooling',
					'label': s.time.dev.cooling,
					'value': { 'value': 3, 'units': 'months', 'dimension': 'time' }
				},{
					'key': 'time_dev_instruments',
					'label': s.time.dev.instruments,
					'value': { 'value': 5, 'units': 'months', 'dimension': 'time' }
				}]
			},{
				'key': 'time_mission',
				'label': s.time.mission,
				'value': { 'value': 18, 'units': 'months', 'dimension': 'time' }
			},{
				'key': 'time_fuel',
				'label': s.time.fuel,
				'value': { 'value': 15, 'units': 'months', 'dimension': 'time' }
			}]
		},{
			'key': 'mass_total',
			'label': 'mass',
			"value": { 'value': 1000, 'units': 'kg', 'dimension': 'mass' },
			"title": s.mass.title,
			"list": [{
				'key': 'mass_satellite',
				'label': s.mass.satellite,
				'value': { 'value': 200, 'units': 'kg', 'dimension': 'mass' }
			},{
				'key': 'mass_mirror',
				'label': s.mass.mirror,
				'value': { 'value': 200, 'units': 'kg', 'dimension': 'mass' }
			},{
				'key': 'mass_cooling_title',
				'label': s.mass.cooling.title,
				'value': { 'value': 250, 'units': 'kg', 'dimension': 'mass' },
				'list': [{
					'key': 'mass_cooling_passive',
					'label': s.mass.cooling.passive,
					'value': { 'value': 50, 'units': 'kg', 'dimension': 'mass' }
				},{
					'key': 'mass_cooling_cryo',
					'label': s.mass.cooling.cryo,
					'value': { 'value': 100, 'units': 'kg', 'dimension': 'mass' }
				},{
					'key': 'mass_cooling_active',
					'label': s.mass.cooling.active,
					'value': { 'value': 100, 'units': 'kg', 'dimension': 'mass' }
				}]
			},{
				'key': 'mass_instruments',
				'label': s.mass.instruments,
				'value': { 'value': 250, 'units': 'kg', 'dimension': 'mass' }
			}]
		}]
		for(var i = 0 ; i < table.length ; i++) this.updateSummaryList(table[i]);


/*
<li id="summaryext_science">
					<div class="padded">
						<h3 class="science"><img src="images/cleardot.gif" class="icon science" /> Mission targets <span class="value">75%</span></h3>
						<ul class="summary">
							<li>Mission target 1: <span class="value science">50%<!--&#x2714; &#x2718--></span></li>
							<li>Mission target 2: <span class="value science">100%</span></li>
						</ul>
					</div>
				</li><li id="summaryext_profile">
					<div class="padded">
						<h3 class="profile"><img src="images/cleardot.gif" class="icon profile" /> Mission profile</h3>
						<ul class="summary">
							<li>Launch site: <span class="value profile">Kennedy Space Center</span></li>
							<li>Launch vehicle: <span class="value profile">Delta IV</span></li>
							<li>Number of instruments: <span class="value profile">2</span></li>
							<li>Orbit: <span class="value profile">Low Earth Orbit</span></li>
							<li>Launch date: <span class="value profile">September 2015</span></li>
							<li>Mission end: <span class="value profile">September 2016</span></li>
						</ul>
<!--<p>A private organization has funded your group to research into the birth and evolution of stars in the distant and nearby Universe, with full analysis of the spectra of the event. The budget of your mission is <span class="cost"><span class="convertable" data-value="2000" data-units="GBP" data-dimension="currency">&pound;2Bn</span></span>. You will need the appropriate instruments on board your satellite in order to observe such objects.</p>-->
					</div>
				</li>*/
		return this;
	}
	
	
	// Convert an input value/unit/dimension object into another unit
	// Inputs:
	//  v - the { "value": 1, "units": "m", "dimension": "length" } object
	//  to - the new unit (must be one of the acceptable units for the dimension
	SpaceTelescope.prototype.convertValue = function(v,to){

		// If the input isn't the sort of thing we expect we just return it
		if(typeof v != "object") return v;

		if(typeof v.value==="string" && v.value != "inf") v.value = parseFloat(v.value,10);

		if(v.dimension == "length"){
			if(to == "m" || to == "km" || to == "ft" || to == "mile" ){
				if(v.units != to){
					// Step 1: convert to SI
					if(v.units == "ft") v.value /= 3.281;
					if(v.units == "km") v.value /= 0.001;
					if(v.units == "mile") v.value *= 1609;
					// Step 2: convert to new unit
					if(to == "ft") v.value *= 3.281;
					if(to == "km") v.value *= 0.001;
					if(to == "mile") v.value /= 1609;
					v.units = to;
				}
				if(v.units=="m" && v.value > 1000){
					v.value /= 1000;
					v.units = "km";
				}
				if(v.units=="ft" && v.value > 5280){
					v.value /= 5280;
					v.units = "mile";
				}
			}
		}else if(v.dimension == "mass"){
			if(to == "kg" || to == "lb" || to == "t"){
				if(v.units != to){
					// Step 1: convert to SI
					if(v.units == "t") v.value /= 0.001;
					else if(v.units == "lb") v.value /= 2.205;
					// Step 2: convert to new unit
					if(to == "t") v.value *= 0.001;
					else if(to == "lb") v.value *= 2.205;
					v.units = to;
				}
			}
		}else if(v.dimension == "temperature"){
			if(to == "K" || to == "C" || to == "F"){
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
			if(to == "years" || to == "months" || to == "days"){
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

	// Format a value. This calls the appropriate format function for the dimension
	// Inputs:
	//  v - the value as an object e.g. { "value": 1, "units": "m", "dimension": "length" }
	//  p - the number of decimal places to show in the output
	SpaceTelescope.prototype.formatValue = function(v,p){
		if(typeof v==="string" || typeof v==="number") return v;
		if(typeof v==="object" && v.dimension){
			if(v.dimension=="length") return this.formatLength(v,p);
			else if(v.dimension=="mass") return this.formatMass(v,p)
			else if(v.dimension=="currency") return this.formatCurrency(v,p)
			else if(v.dimension=="temperature") return this.formatTemperature(v,p)
			else if(v.dimension=="time") return this.formatTime(v,p)
			else return v.value;
		}
		
		return "";
	}

	// Inputs:
	//  v - the { "value": 1, "units": "m", "dimension": "length" } object
	//  p - the number of decimal places to show in the output
	SpaceTelescope.prototype.formatLength = function(v,p){
		v = this.convertValue(v,(this.settings.length) ? this.settings.length : "m")
		if(typeof p==="string") p = parseInt(p,10);
		if(typeof p!=="number") p = (v.units=="km" ? 0 : 1);
		var unit = (this.phrases.ui.units[v.units]) ? this.phrases.ui.units[v.units].unit : "";
		if(v.value > 1e15) return powerOfTen(v.value,unit);
		return ''+addCommas((v.value).toFixed(p))+''+unit;
	}

	// Inputs:
	//  v - the { "value": 1, "units": "m", "dimension": "length" } object
	//  p - the number of decimal places to show in the output
	SpaceTelescope.prototype.formatMass = function(v,p){
		v = this.convertValue(v,(this.settings.mass) ? this.settings.mass : "kg")
		if(typeof p==="string") p = parseInt(p,10);
		var unit = (this.phrases.ui.units[v.units]) ? this.phrases.ui.units[v.units].unit : "";
		if(typeof p!=="number") p = (v.value >= 1000) ? 0 : 1;
		if(v.value > 1e15) return powerOfTen(v.value,unit);
		else return ''+addCommas((v.value).toFixed(p)).replace(/\.0+$/,'').replace(/(\.[1-9])0+$/,"$1")+''+unit;
	}

	// Inputs:
	//  v - the { "value": 1, "units": "m", "dimension": "length" } object
	//  p - the number of decimal places to show in the output
	SpaceTelescope.prototype.formatCurrency = function(v,p){
		// Make a copy of the original so that we don't overwrite it
		v=JSON.parse(JSON.stringify(v));
		v = this.convertValue(v,(this.settings.currency) ? this.settings.currency : "GBP")
		if(typeof p==="string") p = parseInt(p,10);
		if(typeof p!=="number") p = 0;

		var append = (this.phrases.ui.million.compact) ? this.phrases.ui.million.compact : "";
		var s = (this.phrases.ui.currency[v.units] && this.phrases.ui.currency[v.units].symbol) ? this.phrases.ui.currency[v.units].symbol : (this.phrases.ui.currency["GBP"].symbol ? this.phrases.ui.currency["GBP"].symbol : "");

		if(v.value == "inf" || v.value >= 1e15) return '&infin;';

		// Correct for sign of currency (we can have negative values)
		var d = (v.value < 0) ? '-' : '';
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
		var val = (v.value).toFixed(p).replace(/\.0+$/,'').replace(/(\.[1-9])0+$/,"$1");
		return d+s+val+append;
	}


	// Inputs:
	//  v - the { "value": 1, "units": "m", "dimension": "length" } object
	//  p - the number of decimal places to show in the output
	SpaceTelescope.prototype.formatTemperature = function(v,p){
		v = this.convertValue(v,(this.settings.temperature) ? this.settings.temperature : "K")
		if(typeof p==="string") p = parseInt(p,10);
		if(typeof p!=="number") p = (v.value > 1000) ? 0 : 1;
		var unit = (this.phrases.ui.units[v.units]) ? this.phrases.ui.units[v.units].unit : "";
		if(typeof v.value==="string") v.value = parseInt(v.value,10)
		return ''+addCommas((v.value).toFixed(p).replace(/\.0+$/,'').replace(/(\.[1-9])0+$/,"$1"))+''+unit;
	}

	// Inputs:
	//  v - the { "value": 1, "units": "m", "dimension": "length" } object
	//  p - the number of decimal places to show in the output
	SpaceTelescope.prototype.formatTime = function(v,p){
		if(v.units=="years" && v.value < 5) v = this.convertValue(v,"months");
		if(typeof p==="string") p = parseInt(p,10);
		if(typeof p!=="number") p = (v.value >= 6) ? 0 : 1;
		var unit = (this.phrases.ui.units[v.units]) ? this.phrases.ui.units[v.units].unit : "";
		if(typeof v.value==="string") v.value = parseInt(v.value,10)
		return ''+addCommas((v.value).toFixed(p).replace(/\.0+$/,'').replace(/(\.[1-9])0+$/,"$1"))+''+unit;
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
			if(e && typeof e==="object") e.preventDefault();
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
			}else{
				$('#designer').show().find('a').eq(0).focus();
			}
			this.updateBodyClass('showdesigner');
			this.setScroll('#'+view);
		}else if(view=="intro"){
			$('#summaryext').hide();
			$('#intro').show();
			this.updateBodyClass('showintro');
		}else if(view=="scenarios"){
			$('#summaryext').hide();
			$('#scenarios').show();
			this.updateBodyClass('showscenarios');
		}else{
			$('#intro').show();
			this.updateBodyClass('showintro');
		}

		if(this.pushstate && !e) history.pushState({},"Guide","#"+view);

		return this;
	}

	SpaceTelescope.prototype.setScroll = function(el){
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
						for(i in this.data.cooling){
							table += '<tr>';
							table += '<td>'+this.formatValue(this.data.cooling[i].temperature)+'</td>';
							table += '<td>'+this.formatValue(this.data.cooling[i].cost)+'</td>';
							table += '<td>'+this.formatValue(this.data.cooling[i].mass)+'</td>';
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
								table += '<td>'+this.phrases.designer.instrument.options[i].label+'</td>';
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
				}else if(key=="rocket"){
					table = '';
					for(i in this.data.rocket){
						table += '<tr>';
						table += '<td>'+this.phrases.designer.rocket.options[i].label+'</td>';
						table += '<td>'+this.formatValue(this.data.rocket[i].diameter,0)+'</td>';
						table += '<td>'+this.formatValue(this.data.rocket[i].mass.LEO,0)+'</td>';
						table += '<td>'+this.formatValue(this.data.rocket[i].mass.GTO,0)+'</td>';
						table += '<td>'+this.formatValue(this.data.rocket[i].cost,0)+'</td>';
						table += '<td>'+this.phrases.operator[this.data.rocket[i].operator].label+'</td>';
						if(this.settings.mode=="advanced") table += '<td>'+(this.data.rocket[i].risk*100)+'%</td>';
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
						for(var r in this.data.rocket){
							for(var s=0; s < this.data.rocket[r].sites.length; s++){
								if(this.data.rocket[r].sites[s]==i){
									if(rs.length > 0) rs += ', ';
									rs += ''+this.phrases.designer.rocket.options[r].label+''
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
			this.addCloser($('#guide'),{me:this},function(e){ e.data.me.toggleGuide(); });

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
