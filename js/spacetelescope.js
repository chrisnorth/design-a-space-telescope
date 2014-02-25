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
				if(/^[0-9.]+$/.test(val)) val = parseFloat(val);	// convert floats
				r[key] = val;
				r['length']++;
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

		// Language support
		// Set the user's language using the browser settings. Over-ride with query string set value
		this.lang = (typeof this.q.lang==="string") ? this.q.lang : (navigator) ? (navigator.userLanguage||navigator.systemLanguage||navigator.language||browser.language) : "";
		this.langshort = (this.lang.indexOf('-') > 0 ? this.lang.substring(0,this.lang.indexOf('-')) : this.lang.substring(0,2));
		this.langs = (inp && inp.langs) ? inp.langs : { 'en': 'English' };

		// Set some variables
		this.langurl = "config/%LANG%.json";
		this.dataurl = "config/options.json";
		
		console.log(this);

		this.init();
		return this;
	}

	SpaceTelescope.prototype.init = function(){

		this.loadConfig(this.update);
		this.loadLanguage(this.lang,this.update);

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
				if(url.indexOf(this.lang) > 0){
					console.log('Attempting to load '+this.langshort+' instead');
					this.loadLanguage(this.langshort,fn);
				}
			},
			success: function(data){
				this.langshort = l;
				this.lang = l;
				// Store the data
				this.phrasebook = data;
				if(typeof fn==="function") fn.call(this);
			}
		});
		return this;
	}

	// Update the page using the JSON response
	SpaceTelescope.prototype.update = function(){

		if(!this.phrasebook || !this.data) return this;

		this.updateLanguage();
		
		return this;
	}

	SpaceTelescope.prototype.updateLanguage = function(){

		if(!this.phrasebook || !this.data) return this;

		d = this.phrasebook;

		// Update page title (make sure we encode the HTML entities)
		if(d.title) $('html title').text(htmlDecode(d.title));

		// Update title
		$('h1').text(d.title);

		// Set language direction via attribute and a CSS class
		$('body').attr('dir',(d.language.alignment=="right" ? 'rtl' : 'ltr')).removeClass('ltr rtl').addClass((d.language.alignment=="right" ? 'rtl' : 'ltr'));

	}

	// Helper functions
	function htmlDecode(input){
		return $('<div />').html(input).text();
	}


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
