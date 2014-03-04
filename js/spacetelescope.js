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


	// Control and generate the sound.
	function SpaceTelescope(inp){
	
		// Error checking for jQuery
		if(typeof $!=="function"){
			console.log('No jQuery! Abort! Abort!');
		}

		this.q = $.query();
		this.i = inp;

		// Set some variables
		this.langurl = "config/%LANG%.json";
		this.dataurl = "config/options.json";
		this.scenariourl = "config/scenarios_%LANG%.json";
		
		this.settings = { 'length': 'm', 'currency': 'GBP', 'temperature':'K', 'mass':'kg', 'time': 'months', 'usecookies': false };

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
		$('#summary a').on('click',{me:this},function(e){ e.data.me.toggleMenus('summaryext'); });
		$('a.togglewarnings,a.toggleerrors').on('click',{me:this},function(e){ e.data.me.toggleMenus('messages'); });
		$('a.togglemenu').on('click',{me:this},function(e){ e.data.me.toggleMenus('menu'); });
		$('a.togglelang').on('click',{me:this},function(e){ e.data.me.toggleMenus('language'); });


		// Add main menu events
		$('.baritem .save').parent().on('click',{me:this},function(e){ e.data.me.save().toggleMenus(); });
		$('.baritem .help').parent().on('click',{me:this},function(e){ e.data.me.toggleGlossary().toggleMenus(); });
		if(fullScreenApi.supportsFullScreen){
			// Add the fullscreen toggle to the menu
			$('#menu ul').append('<li class="baritem" data="fullscreen"><a href="#" class="fullscreenbtn"><img src="images/cleardot.gif" class="icon fullscreen" alt="full" /> <span></span></li>');
			// Bind the fullscreen function to the double-click event if the browser supports fullscreen
			$('.baritem .fullscreenbtn').parent().on('click', {me:this}, function(e){ e.data.me.toggleFullScreen().toggleMenus(); });
		}

		// Add events to glossary links
		$('body').on('click','a.glossarylink',{me:this},function(e){
			e.data.me.showGlossary($(this).attr('data'));
		});


		return this;
	}

	SpaceTelescope.prototype.toggleMenus = function(id){
		var m = $('.dropdown');
		for(var i = 0; i < m.length ; i++){
			if($(m[i]).attr('id') == id){
				$(m[i]).slideToggle();
			}else{
				$(m[i]).hide();
			}
		}
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
		$.ajax({
			url: this.dataurl,
			method: 'GET',
			dataType: 'json',
			context: this,
			error: function(){
				console.log('Error loading '+this.dataurl);
			},
			success: function(data){
				// Store the data
				this.data = data;
				if(typeof fn==="function") fn.call(this);
			}
		});
		return this;
	}

	// Load the specified language
	// If it fails and this was the long variation of the language (e.g. "en-gb" or "zh-yue"), try the short version (e.g. "en" or "zh")
	SpaceTelescope.prototype.loadLanguage = function(l,fn){
		if(!l) l = this.langshort;
		var url = this.langurl.replace('%LANG%',l);
		$.ajax({
			url: url,
			method: 'GET',
			dataType: 'json',
			context: this,
			error: function(){
				console.log('Error loading '+l);
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
		var url = this.scenariourl.replace('%LANG%',this.langshort);
		$.ajax({
			url: url,
			method: 'GET',
			dataType: 'json',
			context: this,
			error: function(){
				console.log('Error loading '+url);
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

		if(!this.phrases || !this.data) return this;

		this.updateLanguage();
		$('#language.dropdown').hide()
		
		return this;
	}

	SpaceTelescope.prototype.updateLanguage = function(){

		if(!this.phrases || !this.data) return this;

		d = this.phrases;

		// Update page title (make sure we encode the HTML entities)
		if(d.title) $('html title').text(htmlDecode(d.title));

		// Update title
		$('h1').text(d.title);

		// Set language direction via attribute and a CSS class
		$('body').attr('dir',(d.language.alignment=="right" ? 'rtl' : 'ltr')).removeClass('ltr rtl').addClass((d.language.alignment=="right" ? 'rtl' : 'ltr'));

		var html = "<ul>";

		for(var l in this.data.rocket){
			html += '<li><div class="rocket">'+this.phrases.options.rocket[l].label+'</div><div class="operator"><img src="'+this.data.operator[this.data.rocket[l].operator].img+'" alt="'+this.phrases.options.operator[this.data.rocket[l].operator].label+'" title="'+this.phrases.options.operator[this.data.rocket[l].operator].label+'"></div><div class="diameter"><strong>Diameter:</strong> '+this.formatValue(this.data.rocket[l].diameter)+'</div> <div class="currency"><strong>Cost:</strong> '+this.formatValue(this.data.rocket[l].cost)+'</div><div class="mass"><strong>Mass to LEO:</strong> '+this.formatMass(this.data.rocket[l].mass.LEO)+'<br /><strong>Mass beyond LEO:</strong> '+this.formatMass(this.data.rocket[l].mass.GTO)+'</div><div class="risk"><strong>Risk:</strong> '+(this.data.rocket[l].risk)+'</div>'
			html += '<div class="sites"><strong>Sites:</strong> <br />'
			for(var i = 0; i < this.data.rocket[l].sites.length; i++){
				html += ''+this.phrases.options.site[this.data.rocket[l].sites[i]].label+'<br />';
			}
			html += '</div></li>';
		}
		html += "</ul>";
		$('#output').html(html);

		// Update menu
		$('.togglemenu').attr('title',d.ui.menu.title);
		$('#menu ul li').each(function(i){
			var id = $(this).attr('data');
			$(this).find('span').html(d.ui.menu[id])
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


		var li = '';
		var txt = '';
		for(var i = 0; i < this.scenarios.length; i++){
			txt = (typeof this.scenarios[i].description==="string") ? this.scenarios[i].description : "";
			li += '<li><h3>'+this.scenarios[i].name+'</h3><p>'+txt.replace(/%COST%/,this.formatValue(this.scenarios[i].budget))+'</p></li>'
		}
		$('#scenarios').html(li);

		return this;
	}

	// Convert an input value/unit/dimension object into another unit
	// Inputs:
	//  v - the { "value": 1, "units": "m", "dimension": "length" } object
	//  to - the new unit (must be one of the acceptable units for the dimension
	SpaceTelescope.prototype.convertValue = function(v,to){

		// If the input isn't the sort of thing we expect we just return it
		if(typeof v != "object") return v;

		if(typeof v.value==="string") v.value = parseFloat(v.value,10);

		if(v.dimension == "length"){
			if(to == "ft" || to == "m" || to == "mm" || to == "km"){
				if(v.units != to){
					// Step 1: convert to SI
					if(v.units == "ft") v.value /= 3.281;
					else if(v.units == "mm") v.value /= 1000;
					else if(v.units == "km") v.value /= 0.001;
					// Step 2: convert to new unit
					if(to == "ft") v.value *= 3.281;
					else if(to == "mm") v.value *= 1000;
					else if(to == "km") v.value *= 0.001;
					v.units = to;
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
					// Step 2: convert to new unit
					if(to == "months") v.value *= 12;
					else if(to == "days") v.value *= 365.25;
					v.units = to;
				}
			}
		}else if(v.dimension == "currency"){
			if(this.data.currency[to]){
				if(v.units != to){
					// Step 1: convert to GBP
					if(this.data.currency[v.units].conv) v.value /= this.data.currency[v.units].conv;
					// Step 2: convert to new unit
					if(this.data.currency[to].conv) v.value *= this.data.currency[to].conv;
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
		if(typeof v==="object" && v.value){
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
		if(!p) p = 1;
		var unit = (this.phrases.ui.units[v.units]) ? this.phrases.ui.units[v.units].unit : "";
		return ''+addCommas((v.value).toFixed(p))+''+unit;
	}

	// Inputs:
	//  v - the { "value": 1, "units": "m", "dimension": "length" } object
	//  p - the number of decimal places to show in the output
	SpaceTelescope.prototype.formatMass = function(v,p){
		v = this.convertValue(v,(this.settings.mass) ? this.settings.mass : "kg")
		if(typeof p==="string") p = parseInt(p,10);
		var unit = (this.phrases.ui.units[v.units]) ? this.phrases.ui.units[v.units].unit : "";
		if(!p) p = (v.value > 1000) ? 0 : 1;
		return ''+addCommas((v.value).toFixed(p))+''+unit;
	}

	// Inputs:
	//  v - the { "value": 1, "units": "m", "dimension": "length" } object
	//  p - the number of decimal places to show in the output
	SpaceTelescope.prototype.formatCurrency = function(v,p){
		v = this.convertValue(v,(this.settings.currency) ? this.settings.currency : "GBP")
		if(typeof p==="string") p = parseInt(p,10);
		if(!p) p = 0;


		var append = (this.phrases.ui.million.compact) ? this.phrases.ui.million.compact : "";
		var s = (this.phrases.ui.currency[v.units] && this.phrases.ui.currency[v.units].symbol) ? this.phrases.ui.currency[v.units].symbol : (this.phrases.ui.currency["GBP"].symbol ? this.phrases.ui.currency["GBP"].symbol : "");

		// Change the "million" to "billion" if the number if too big
		if(v.value >= 1000){
			v.value /= 1000;
			p = 2;
			append = (this.phrases.ui.billion.compact) ? this.phrases.ui.billion.compact : "";
		}
		return s+''+(v.value).toFixed(p)+''+append;
	}


	// Inputs:
	//  v - the { "value": 1, "units": "m", "dimension": "length" } object
	//  p - the number of decimal places to show in the output
	SpaceTelescope.prototype.formatTemperature = function(v,p){
		v = this.convertValue(v,(this.settings.temperature) ? this.settings.temperature : "K")
		if(typeof p==="string") p = parseInt(p,10);
		if(!p) p = (v.value > 1000) ? 0 : 1;
		var unit = (this.phrases.ui.units[v.units]) ? this.phrases.ui.units[v.units].unit : "";
		return ''+addCommas((v.value).toFixed(p))+''+unit;
	}

	// Inputs:
	//  v - the { "value": 1, "units": "m", "dimension": "length" } object
	//  p - the number of decimal places to show in the output
	SpaceTelescope.prototype.formatTime = function(v,p){
		v = this.convertValue(v,(this.settings.time) ? this.settings.time : "months")
		if(typeof p==="string") p = parseInt(p,10);
		if(!p) p = (v.value >= 6) ? 0 : 1;
		var unit = (this.phrases.ui.units[v.units]) ? this.phrases.ui.units[v.units].unit : "";
		return ''+addCommas((v.value).toFixed(p))+''+unit;
	}

	SpaceTelescope.prototype.toggleFullScreen = function(){
		// Get the container
		this.elem = document.getElementById("page");

		if(fullScreenApi.isFullScreen()){
			fullScreenApi.cancelFullScreen(this.elem);
			this.fullscreen = false;
			$('#page').removeClass('fullscreen');
		}else{
			fullScreenApi.requestFullScreen(this.elem);
			this.fullscreen = true;
			$('#page').addClass('fullscreen');
		}
		//this.resize();
		return this;
	}

	SpaceTelescope.prototype.toggleGlossary = function(key){
		if($('#intro').is(':visible')){
			$('#intro').hide();
			this.showGlossary(key);
			$('#glossary').show();
		}else{
			$('#glossary').hide();
			$('#intro').show();
		}
		return this;
	}

	SpaceTelescope.prototype.showGlossary = function(key){

		var html = "";
		var g = this.phrases.glossary;
		var v,ul,table,txt;

		if($('#glossary').length == 0) $('#page').append('<div id="glossary"></div>')

		if(key){
			html += '<p class="breadcrumb"><a href="#glossary" class="glossarylink" data="">'+g.title+'</a> &raquo; '+g[key].title+'</p>'

			txt = g[key].about;
			if(key=="mirror"){
				table = '';
				for(i in this.data.mirror){
					table += '<tr>';
					table += '<td>'+this.formatValue(this.data.mirror[i].diameter)+'</td>';
					table += '<td>'+this.formatValue(this.data.mirror[i].mass)+'</td>';
					table += '<td>'+this.formatValue(this.data.mirror[i].cost)+'</td>';
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
			}

			if(txt.indexOf('<p>') < 0) txt = '<p>'+txt+'</p>';
			html += '<h2>'+g[key].title+'</h2>'+txt;

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
						html += '<div id="'+k+'" class="mission"><h3>'+g[key]["missions"][k].title+'</h3>';
						if(g[key]["missions"][k]["image"]) html += '<img src="'+g[key]["missions"][k]["image"].src+'" alt="'+g[key]["missions"][k]["title"]+'" />';
						html += '</div>';
						html += ul;
					}
				}
			}
		}else{
			html += '<h2>'+this.phrases.glossary.title+'</h2><p>'+this.phrases.glossary.about+'</p><ul>';
			for(k in this.phrases.glossary){
				if(k != "title" && k != "about" && typeof this.phrases.glossary[k].title==="string"){
					html += '<li><a href="#glossary" class="glossarylink" data="'+k+'">'+this.phrases.glossary[k].title+'</a></li>';
				}
			}
			html += '</ul>'
		}

		// Add closer
		$('#glossary').html('<img src="images/cleardot.gif" class="icon close" />'+html);

		// Add events to glossary close
		$('#glossary img.close').on('click',{me:this},function(e){
			e.data.me.toggleGlossary();		
		});

		$('#glossary').show();
		$('#intro').hide();

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
