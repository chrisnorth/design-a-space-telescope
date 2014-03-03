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
		
		this.settings = { 'length': 'm', 'currency': 'GBP', 'usecookies': false };

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

		this.loadConfig(this.update);
		this.loadLanguage(this.lang,this.update);
		
		// Build language list
		var list = "";
		for(l in this.langs) list += '<li class="baritem"><a href="#">'+this.langs[l]+' ['+l+']</a></li>'
		$('#language ul').html(list);

		// Make menu toggles active
		$('a.togglemenu').on('click',{me:this},function(e){ $('#language').hide(); $('#menu').slideToggle(); });
		$('a.togglelang').on('click',{me:this},function(e){ $('#menu').hide(); $('#language').slideToggle(); });

		// Add save event
		$('.baritem .save').parent().on('click',{me:this},function(e){
			e.data.me.save();
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
				if(typeof fn==="function") fn.call(this);
			}
		});
		return this;
	}

	// Update the page using the JSON response
	SpaceTelescope.prototype.update = function(){

		if(!this.phrases || !this.data) return this;

		this.updateLanguage();
		
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
		console.log(this.data.rocket)
		for(var l in this.data.rocket){
			html += '<li><div class="rocket">'+this.phrases.options.rocket[l].label+'</div><div class="operator"><img src="'+this.data.operator[this.data.rocket[l].operator].img+'" alt="'+this.phrases.options.operator[this.data.rocket[l].operator].label+'" title="'+this.phrases.options.operator[this.data.rocket[l].operator].label+'"></div><div class="diameter"><strong>Diameter:</strong> '+this.formatLength(this.data.rocket[l].diameter)+'</div> <div class="currency"><strong>Cost:</strong> '+this.formatCurrency(this.data.rocket[l].cost)+'</div><div class="mass"><strong>Mass to LEO:</strong> '+this.formatMass(this.data.rocket[l].mass.LEO)+'<br /><strong>Mass beyond LEO:</strong> '+this.formatMass(this.data.rocket[l].mass.GTO)+'</div><div class="risk"><strong>Risk:</strong> '+(this.data.rocket[l].risk)+'</div>'
			html += '<div class="sites"><strong>Sites:</strong> <br />'
			for(var i = 0; i < this.data.rocket[l].sites.length; i++){
				html += ''+this.phrases.options.site[this.data.rocket[l].sites[i]].label+'<br />';
			}
			html += '</div></li>';
		}
		html += "</ul>";
		$('#output').html(html);

		return this;
	}

	// Inputs:
	//  n - the number
	//  u - the unit e.g. "m" or "ft"
	//  p - the number of decimal places to show in the output
	SpaceTelescope.prototype.formatLength = function(n,u,p){
		if(typeof n==="string") n = parseFloat(n,10);
		if(!u) u = (this.settings.length) ? this.settings.length : "m";
		if(typeof p==="string") p = parseInt(p,10);
		if(!p) p = 1;
		var unit = (this.phrases.ui.units[u]) ? this.phrases.ui.units[u].unit : "";
		var conv = (this.data.units[u].conv) ? this.data.units[u].conv : 1;
		return ''+addCommas((n*conv).toFixed(p))+''+unit;
	}

	// Inputs:
	//  n - the number
	//  u - the unit e.g. "kg" or "lb"
	//  p - the number of decimal places to show in the output
	SpaceTelescope.prototype.formatMass = function(n,u,p){
		if(typeof n==="string") n = parseFloat(n,10);
		if(!u) u = (this.settings.mass) ? this.settings.mass : "kg";
		if(typeof p==="string") p = parseInt(p,10);
		var unit = (this.phrases.ui.units[u]) ? this.phrases.ui.units[u].unit : "";
		var conv = (this.data.units[u].conv) ? this.data.units[u].conv : 1;
		n *= conv;
		if(!p){
			p = (n > 1000) ? 0 : 1;
		}
		return ''+addCommas((n).toFixed(p))+''+unit;
	}

	// Inputs:
	//  n - the number
	//  c - the currency e.g. "GBP", "USD", "EUR"
	//  p - the number of decimal places to show in the output
	SpaceTelescope.prototype.formatCurrency = function(n,c,p){
		if(typeof n==="string") n = parseFloat(n,10);
		if(!c) c = (this.settings.currency) ? this.settings.currency : "GBP";
		if(typeof p==="string") p = parseInt(p,10);
		if(!p) p = 0;
		var append = (this.phrases.ui.million) ? this.phrases.ui.million : "";
		var s = (this.phrases.ui.currency[c] && this.phrases.ui.currency[c].symbol) ? this.phrases.ui.currency[c].symbol : (this.phrases.ui.currency["GBP"].symbol ? this.phrases.ui.currency["GBP"].symbol : "");
		var conv = (this.data.currency[c] && this.data.currency[c].conv) ? this.data.currency[c].conv : 1;
		n *= conv;
		// Change the "million" to "billion" if the number if too big
		if(n >= 1000){
			n /= 1000;
			append = (this.phrases.ui.billion) ? this.phrases.ui.billion : "";
		}
		return s+''+(n).toFixed(p)+''+append;
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
