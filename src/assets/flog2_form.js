/* 
* FLOG2 middle layer between charting library and html ui form.
* -Binds html form data to Flog2 object. 
* -Controls the behavior of Flog2 chart object.
*/
"use strict";!function(){

var flog2_form = flog2_form || {
    f2obj: {},
    forms: [],
    fieldsets: {},
    conf: {},
    changed: [],
    _gcls: function(v) {
        return document.getElementsByClassName(v);
    },
    _gid: function(v) {
        return document.getElementById(v);
    },
    _d: function(v) {
        return "undefined" !== typeof v;
    },
    getPreviousSibling: function(n) {
        var x = n.previousSibling;
        while (x.nodeType != 1) 
            x = x.previousSibling;
        return x;
    },
    getNextSibling: function(n) {
        var x = n.nextSibling;
        while (x.nodeType != 1) 
            x = x.nextSibling;
        return x;
    },

    init: function() {
		console.trace("init");
        // Refresh button click
        var btn_refresh = document.getElementsByName("refresh")[0];
        btn_refresh.addEventListener("click", 
            this.redraw.bind(this), false);

        // Download button click
        var btn_dl = document.getElementsByName("download")[0], t = this;
        btn_dl.addEventListener("click", function(){
            t.f2obj.preventUnload = true;
            t.download(this);
        }, false);

        // If window dimensions are changed, resize chart
        window.addEventListener("resize", 
            this.getChartHeight.bind(this), false);

        // Autoscale event handler
        // Listen to .autoscale input field events to update
        // height parameters .
        var as = document.getElementsByClassName("autoscale");
        for(var i=as.length;i--;) {
            as[i].addEventListener("blur", 
                this.autoscale, false);
        }

        // Draggable pane
        //var dt = document.getElementById("drag-tab");
        //dt.addEventListener("mousedown", 
        //    this.startDragHandler.bind(this), false);

        // Collapsible left pane
        var ct = document.getElementsByClassName("flog2_form_collapser_btn");
        for(var i=ct.length;i--;)
            ct[i].addEventListener("click", 
                this.toggleFormArea, false);

        var ct = document.getElementsByClassName("drag-button");
        for(var i=ct.length;i--;)
            ct[i].addEventListener("mousedown",
                this.startDragHandler.bind(this), false);

        // Inject dropdown column selectors to placeholder div(s)
        // with classname ".data-column-selecto" 
        this.addDataColumnSelectorsHTML();

        // Add axis selector
        this.addAxisSelectorHTML();
    
        // Load F2 chart
        this.run();
    },

    getInputs: function() {
        var form = this._gcls("flog2_form")[0],
            fs_l = form.getElementsByTagName("fieldset");
        for(var i=0, nf=fs_l.length; i<nf; i++) {
            if(fs_l[i].name == "axes") 
                continue;
            this.conf[fs_l[i].name] = {};
            var f_l = fs_l[i].elements;
            for(var j=0,m=f_l.length;j<m;j++) {
                if(!f_l[j].hasAttribute("data-value") 
                || ""+f_l[j].value != f_l[j].getAttribute("data-value")) {
                    this.changed.push(fs_l[i].name+"."+f_l[j].name);
                }
                if(f_l[j].type == "radio" 
                && !f_l[j].checked)
                    continue;
                if(f_l[j].type == "checkbox") {
                    this.conf[fs_l[i].name][f_l[j].name] = f_l[j].checked;
                    continue;
                }
                this.conf[fs_l[i].name][f_l[j].name] =
                    f_l[j].type === "number" ? +f_l[j].value : f_l[j].value;
            }
        }
    },
        
    attachToObject: function() {
        var cols_o = this.getChartColumns(), 
            pointer = {b:null, e:0};

        for(var fs in this.conf) {
            var c = this.conf[fs];
            if(fs == 'Flog2') {                
                // General settings
                for(var ck in c) {
                    if(this.changed.indexOf(fs+"."+ck) === -1 
                    || ck == "dataStr")
                        continue;
                    this.f2obj[ck] = c[ck];
                }
                // If chart proportions are changed
                // then the whole chart should be redrawn
                // First assess which width elements were changed
                this.f2obj.outerWidth = null;
                this.f2obj.chartScale = null;
                this.f2obj.chartHeightmm = null;
                this.f2obj.outerHeight = null;
                this.f2obj.chartHeight = null;
                // If user changed minDepth or maxDepth then
                // allow not round scale and calculate scale
                // based on chartHeightmm. Otherwise scale
                // is used 
                if(this.changed.indexOf(fs+".minDepth") != -1
                || this.changed.indexOf(fs+".maxDepth") != -1) {
                    this.f2obj.roundScale = false;
                    this.f2obj.chartHeightmm = c.chartHeightmm;
                } else {
                    //this.f2obj.roundScale = true;
                    this.f2obj.chartScale = c.chartScale;
                }
            } else {
                for(var ck in c) {
                    if(this.changed.indexOf(fs+"."+ck) === -1)
                        continue;
                    if(!(fs in this.f2obj.chartsConf))
                        this.f2obj.chartsConf[fs] = {};
                    this.f2obj.chartsConf[fs][ck] = c[ck];
                }
                // Add and remove charts
                this.attachChartsToObject(cols_o, pointer, fs);

                // Is chart point size fixed or proportional
                if("pointSizeVaries" in this.conf[fs])
                    this.f2obj["setChart"+
                        (this.conf[fs].pointSizeVaries?"Proportional":"Fixed")
                    ](fs);
            }           
        }
        this.changed.length = 0;

        for(var i=this.f2obj.charts.length;i--;)
            if(this.f2obj.charts[i].constructor.name == "VerticalLineChart")
                this.f2obj.charts[i].labelRender();
    },

    attachDataStrToObject: function() {
        var c = this.conf.Flog2;
        //this.f2obj.dataStr = this.conf.Flog2.dataStr;
        c.dataDelimiter = this._d(c.dataDelimiter) ? 
            c.dataDelimiter : this.f2obj.dataDelimiter;
        this.f2obj.data = (function(dl, str) {
            str = JSON.parse(str);
            switch(dl) {
                 case "\\t", "\t": return d3.tsv.parse(str);
                 case ",": return d3.csv.parse(str);
                 case ";": return d3.dsv(";", "text/plain")
                                    .parse(";", str);
            }
        })(c["dataDelimiter"], this.f2obj.dataStr);
    },

    attachChartsToObject: function(cols_o, pointer, fs) {
        var flag = false;
        // Remove unused object
        for(var i=this.f2obj.charts.length;i--;) {
            var c=this.f2obj.charts[i];
            
            if(c.constructor.name == fs) {
                if(!flag) pointer.e = i+1; flag = true;
                if(!this._d(cols_o[fs]) 
                || cols_o[fs].indexOf(c.column) == -1) {
                    // remove
                    this.f2obj.charts[i].remove();
                    this.f2obj.charts.splice(i, 1);
                    pointer.e--;
                }
                if(flag) pointer.b = i;                
            }
        }

        if(!flag) pointer.b = pointer.e;

        if(fs in cols_o)
            for(var i=0,n=this.f2obj.DATA_COLUMNS.length;i<n;i++) {
                var k = this.f2obj.DATA_COLUMNS[i],
                    jump = false;
                // If chart already exists, dont create a new one
                for(var j=pointer.b,m=this.f2obj.charts.length;j<m;j++) {
                     if(cols_o[fs].indexOf(k)!=-1 
                     && this.f2obj.charts[j].column == k) {
                         jump = true;
                         pointer.b++;
                     }
                }
                if(jump) continue;
                if(cols_o[fs].indexOf(k)!=-1) {
                    // Create new chart object
                    var newObj={
                            title: k,
                            column: k,
                            name: "chart-"+fs+"-"+pointer.b,
                            type: fs
                    };
                    for(var js in this.conf[fs])
                        newObj[js] = this.conf[fs][js];
                    this.f2obj.charts.splice(pointer.b, 0, newObj);
                    this.f2obj.initObject("charts", pointer.b);
                    pointer.b++;
                }
            }
        pointer.b = pointer.e;
    },

    // Update form data
    attachToForm: function() {
        // Update data-as-string textarea
        var ds=this._gid("Flog2DataStr");
        if(this._d(ds)) {
            var str = this.f2obj.dataStr == "" ? 
                          "\"\"" : this.f2obj.dataStr;
            ds.innerHTML = JSON.parse(str);
            ds.setAttribute("data-value", str);
        }
        // Iterate over form fieldsets
        var form=this._gcls("flog2_form")[0],
            fs_l = form.getElementsByTagName("fieldset");
        
        for(var i=fs_l.length;i--;) {
            var fs = fs_l[i].name,
                inp_l = [], 
                k_l=["input","select"];
            for(var j=k_l.length;j--;) {
                var e=fs_l[i].getElementsByTagName(k_l[j]);
                for(var j_=e.length;j_--;)
                    inp_l.push(e[j_]);
            }
            // General chart area data
            if(fs == "Flog2") {
                // Set datadelimiter radio
                for(var j=inp_l.length;j--;) {
                    if(inp_l[j].name == "dataDelimiter") {
                        inp_l[j].checked = (inp_l[j].value == this.f2obj.dataDelimiter.replace("\t","\\t"));
                        continue;
                    }
                    inp_l[j].value = this.f2obj[inp_l[j].name];
                    inp_l[j].setAttribute("data-value", this.f2obj[inp_l[j].name]);
                }
            } else if(fs == "axes") {
                this.setAxesVisible(inp_l.reverse());
            } else {
                // Set data charts that are visible
                var visibleCharts = {};//, chartConf = {};
                for(var i_=this.f2obj.charts.length;i_--;){
                    var c=this.f2obj.charts[i_];
                    if(!this._d(visibleCharts[c.column]))
                        visibleCharts[c.column]=[];
                    visibleCharts[c.column]
                        .push(c.constructor.name);
                }
                this.setChartColumns(visibleCharts);

                // Set general data
                // If chart is not visible in the chart area, take the value from
                // class constructor
                for(var j=inp_l.length;j--;) {
                    var v = (fs in this.f2obj.chartsConf && inp_l[j].name in this.f2obj.chartsConf[fs]) ? 
                                this.f2obj.chartsConf[fs][inp_l[j].name] : null;
                    if(inp_l[j].type != "checkbox")
                        inp_l[j].value = v;
                    else 
                        inp_l[j].checked = v;
                    inp_l[j].setAttribute("data-value", v);
                }
            }
        }
    },

    // Form dropdown selectors

    addDataColumnSelectorsHTML: function() {
        var placeholders = this._gcls("data-column-selector");

        if(placeholders.length > 0) {
            if(!this._gid("modal-content")||!this._d(div_content)) {
                var div_bg=document.createElement("div"),
                    div_container=document.createElement("div"),
                    div_content=document.createElement("div");
                div_bg.id="modal-background";
                div_container.id="modal-container";
                div_content.id="modal-content";
                document.body.appendChild(div_container);
                div_container.appendChild(div_bg);
                div_container.appendChild(div_content);
                div_bg.addEventListener("click", function(){
                    div_container.style.display="none";
                }, false);
                
            }
            var ul=document.createElement("ul");
            var div_select = document.createElement("div");
            div_select.innerHTML="Select all";
            div_select.style.cursor = "pointer";
            div_select.addEventListener("click", 
                this.columnSelectAll, false);
            ul.appendChild(div_select);
            var div_select = document.createElement("div");
            div_select.innerHTML="Deselect all";
            div_select.style.cursor = "pointer";
            div_select.addEventListener("click", 
                this.columnDeselectAll, false);
            ul.appendChild(div_select);

            for(var j=0,n=this.f2obj.DATA_COLUMNS.length;j<n;j++) {
                var li=document.createElement("li"), 
                    k=this.f2obj.DATA_COLUMNS[j];
                li.innerHTML=k;
                li.addEventListener("click", 
                    this.columnToggler, false);
                ul.appendChild(li);
            }
            div_content.appendChild(ul);
        }
        for(var i=placeholders.length;i--;) {
            placeholders[i].dataset.type=placeholders[i].parentNode.name;
            placeholders[i].addEventListener("click", 
                this.columnSelector, false);
        }
    },

    updateDataColumnSelectorsHTML: function () {
        var ul = this._gid("modal-content").children[0],
            li = ul.getElementsByTagName("li");
        // Remove existing column names
        for(var j=li.length;j--;)
            ul.removeChild(li[j]);
            // Add new columns
            for(var j=0,n=this.f2obj.DATA_COLUMNS.length;j<n;j++) {
                var li=document.createElement("li"), 
                    k=this.f2obj.DATA_COLUMNS[j];
                li.innerHTML=k;
                li.addEventListener("click", 
                    this.columnToggler, false);
                ul.appendChild(li);
            }
    },

    columnToggler: function(){
        var type = this.parentNode.dataset.type;
        this.dataset.type = this.dataset.type||"";
        this.dataset.type = this.dataset.type.replace(type, "");
        
        if(this.classList.contains("_bold")) {
            this.classList.remove("_bold");
        } else {
            this.classList.add("_bold");
            this.dataset.type+=","+type;
            //this.dataset.type=("undefined" !== typeof this.dataset.type ? 
            //    this.dataset.type+",":"")+type;
        }
        this.dataset.type = this.dataset.type
            .replace(",,",",")
            .replace(/(^,)|(,$)/g, "");
    },

    columnSelectAll: function() {
        var type = this.parentNode.dataset.type,
            li = this.parentNode.getElementsByTagName("li");
        for(var i=li.length;i--;) {
            li[i].classList.add("_bold");
            li[i].dataset.type = li[i].dataset.type||"";
            li[i].dataset.type = li[i].dataset.type
                .replace(type, "")+","+type
                .replace(",,",",")
                .replace(/(^,)|(,$)/g, "");
            //li[i].dataset.type=("undefined" !== typeof li[i].dataset.type ? 
            //    li[i].dataset.type+",":"")+type;
        }
    },
    columnDeselectAll: function() {
        var type = this.parentNode.dataset.type,
            li = this.parentNode.getElementsByTagName("li");
        for(var i=li.length;i--;) {
            li[i].classList.remove("_bold");
            if("undefined" !== typeof li[i].dataset.type) 
                li[i].dataset.type = li[i].dataset.type
                    .replace(type, "")
                    .replace(",,",",")
                    .replace(/(^,)|(,$)/g, "");
        }
    },
    columnSelector: function() {
        document.getElementById("modal-container").style.display="block";
        
        var type = this.dataset.type,
            ul=document.getElementById("modal-content").children[0],
            li_l = ul.children;
        ul.dataset.type=type;
        for(var i=li_l.length;i--;) {
            li_l[i].classList.remove("_bold");
            if("undefined" !== typeof li_l[i].dataset.type 
            && li_l[i].dataset.type.indexOf(type)!=-1) {
                 li_l[i].classList.add("_bold");
            }
        }

        var width = ul.parentNode.offsetWidth,
            height = ul.parentNode.offsetHeight;
        ul.parentNode.style.marginLeft = (-width/2)+"px";
        ul.parentNode.style.marginTop = (-height/2)+"px";

        ul.parentNode.style.left = "50%";
        ul.parentNode.style.top = "50%";
    },

    getChartColumns: function() {
        var li_l = this._gid("modal-content").children[0].children,
            c_l = {};
        for(var i=0, n=li_l.length; i<n; i++) {
            var t_l = li_l[i].dataset.type;
            if(this._d(t_l)) {
                t_l = t_l.split(",");
                if(t_l[0]=="") t_l.shift();
                for(var j=t_l.length;j--;) {
                    if(!this._d(c_l[t_l[j]]))
                        c_l[t_l[j]]=[];
                    c_l[t_l[j]].push(li_l[i].innerHTML);
                }
            }
        }
        return c_l;
    },

    setChartColumns: function(visibleCharts) {
        var li_l = this._gid("modal-content").children[0].children,
            c_l = {};
        for(var i=li_l.length;i--;) {
             li_l[i].dataset.type = li_l[i].innerHTML in visibleCharts ? 
                 visibleCharts[li_l[i].innerHTML].join(",") : "";
        }
    },

    addAxisSelectorHTML: function() {
        var fs = document.getElementsByTagName("fieldset"), 
            t = this;
        for(var i=fs.length;i--;) {
            if(fs[i].name != "axes") 
                continue;
            var i_l = fs[i].getElementsByTagName("input");
            for(var j=0,n=i_l.length;j<n;j++) {
                if(i_l[j].name != "axis-visibility[]") 
                    continue;
                i_l[j].checked = false;
                i_l[j].disabled="disabled"
                for(var ai = this.f2obj.axes.length; ai--;) {
                    if(this.f2obj.axes[ai].constructor.name == i_l[j].value) {
                        i_l[j].checked = this.f2obj.axes[j].isVisible;
                        i_l[j].removeAttribute("disabled");
                        if(!i_l[j].hasAttribute("data-clickable")) {
                            i_l[j].setAttribute("data-clickable", ai);
                            i_l[j].addEventListener("click", function(){
                                t.f2obj.axes[+this.dataset.clickable].isVisible = this.checked;
                                t.f2obj.redraw();
                            }, false);
                        }
                    }
                }
            }
            break;
        }
    },

    setAxesVisible: function(inp_l) {
        for(var i=0,n=inp_l.length;i<n;i++)
            if(this._d(this.f2obj.axes[i]))
                inp_l[i].checked = this.f2obj.axes[i].isVisible;
    },

    run: function() {
        this.getInputs();
        this.attachToForm();
    },


// 8< -- 8< -- 8<

    resize_hook: function() {
        this.chartScale = this.getChartScale();
        var d_=document.getElementsByName("Flog2")[0],
            f_l=["minDepth","maxDepth","chartScale"];
        if("undefined" !== typeof d_) {
            var d=d_.getElementsByTagName("input");
            for(var i=d.length;i--;) {
                var x=f_l.indexOf(d[i].name);
                if(x!=-1)
                    d[i].value = (+this[f_l[x]]).toFixed(2);
                    //    f_l[x] == "chartScale" && this.roundScale ? 0 : 2
                    //);
            }
        }
    },

    redraw: function () {
        this.getInputs();
        this.attachToObject();
        var ds=this._gid("Flog2DataStr");
        if(ds.value != JSON.parse(ds.dataset.value) || ds.value
            .replace(/(\r\n|\n|\r)/gm, "")
            .replace(" ", "").length < 1) 
        {
            try {
                this.f2obj.remove();
                for(var k in this.f2obj.c)
                    this.f2obj[k] = this.f2obj.c[k];
                this.f2obj.dataStr = JSON.stringify(ds.value);
                this.f2obj.oMinDepth = null;
                this.f2obj.oMaxDepth = null;
                this.attachDataStrToObject();
                // If data was inserted by user
                this.f2obj.COLUMNS = d3.keys(this.f2obj.data[0]) || [];
            } catch (e) {
                console.error(e)
            }
            this.f2obj.draw();
            this.f2obj.setDataColumnsList();
            this.updateDataColumnSelectorsHTML();
            this.addAxisSelectorHTML();
        } else {
            this.f2obj.redraw();
        }
        this.attachToForm();
        return false;
    },

    // .svg file download 
    // http://d3export.housegordon.org
    download: function (that) {
        var name=that.parentNode.id.replace("flog2_form_","");

        // set css to svg
        var css_str="";
        var classes = document.styleSheets[0].rules || document.styleSheets[0].cssRules;    
        for (var x = 0; x < classes.length; x++) {
            css_str += (classes[x].cssText) ? classes[x].cssText : classes[x].style.cssText;
        }
        var svg_style = d3.select("#"+name+"-chart-container")
                            .append("defs")
                            .append("style")
                            .attr("type", "text/css")
                            .text(css_str);
        // /set css to svg

        var svg = document.getElementById(name+"-chart-container");

        // Get the d3js SVG element
        //var tmp = document.getElementsByClassName("chart")[0];
        //var svg = tmp.getElementsByTagName("svg")[0];
        var svg_xml = (new XMLSerializer).serializeToString(svg);
        var form = document.getElementById("svgform");
        form['output_format'].value = 'svg';
        form['data'].value = svg_xml ;
        //window.removeEventListener("beforeunload", this.f2obj.remove);
        form.submit();
    },

    getChartHeight: function () {
        this.f2obj.outerWidth = null;

        this.f2obj.chartScale = null;
        this.f2obj.chartHeightmm = null;
        this.f2obj.outerHeight = null;
        this.f2obj.chartHeight = null;

        this.f2obj.redraw();
        this.attachToForm();
    },


    autoscale: function () {
        var maxDepth = null,
            minDepth = null;
        var els=this.parentNode.children;
        for(var i=els.length;i--;){
            if(els[i].name == "maxDepth")
                maxDepth = els[i].value;
            if(els[i].name == "minDepth")
                minDepth = els[i].value;
        };
        if(!minDepth||!maxDepth||this.value==""
            ||isNaN(this.value)||!this.value) {
            return;
        }
        var as=document.getElementsByClassName('autoscale');
        for(var i=as.length;i--;) {
            if(this.name == "chartScale" && as[i].name == "chartHeightmm") {
                as[i].value = (maxDepth - minDepth) * 1000 / this.value;
            }
            if(this.name == "chartHeightmm" && as[i].name == "chartScale") {
                as[i].value = Math.abs(Math.round(((maxDepth - minDepth)*1000) / this.value));
                this.value = (maxDepth - minDepth) * 1000 / as[i].value; // Because scale value is rounded
            }
        }
    },

    // Draggable textarea pane events
    startDragHandler: function (e) {
        e.preventDefault();
        var btn = e.srcElement || e.originalTarget,
            dragged = this.getPreviousSibling(btn.parentNode);//.parentNode.getElementsByClassName("drag-target");
        if(!this._d(dragged)
        || !dragged.hasAttribute('id')) 
            return;

        this.dragEventTarget = dragged.id;
        this.dragEventVertical = dragged.classList.contains("drag-vertical");
        window.addEventListener("mouseup", 
            this.endDragHandler.bind(this), false);
        window.addEventListener('mousemove', 
            this.dragHandler, false);
    },

    dragHandler: function (e) {
        var t_ = flog2_form;
        var target = document.getElementById(t_.dragEventTarget);
        if(!t_._d(target)) {t_.endDragHandler();return;}

        //var c = 0, //document.getElementById("drag-tab-parent"),
        var t = t_.getNextSibling(target);//.parentNode.getElementsByClassName("drag-container");
        if(!t_._d(t)) {
            t_.endDragHandler(); return;
        }

        var p = target; //document.getElementById("Flog2DataStr");
        if(!t_.dragEventVertical) {
            if(e.clientY < 0)
                return;    
            t.style.top = (e.clientY)+"px";
            p.style.height = (e.clientY)+"px";
        } else {
            if(e.clientX < 0)
                return;
            t.style.left = (e.clientX-5)+"px";
            p.style.width = (e.clientX-5)+"px";
        }
    },

    endDragHandler: function (e) {
        e.preventDefault();
        window.removeEventListener('mousemove',
            this.dragHandler, false);
    },

    toggleFormArea: function () {
        var pane = flog2_form.getPreviousSibling(this.parentNode),
            v = pane.style.display!="none";
        pane.style.display = v ? "none" : "block";
        this.parentNode.style.left = pane.offsetWidth+"px";
        //this.innerHTML = "&nbsp;" + (v ? ">" : "<");
        // reposition chart
        var chart = document.getElementsByClassName("chart");
        if(chart.length > 0)
            chart[0].style.marginLeft = (+pane.offsetWidth+30)+"px";
    }

// >8 -- >8 -- >8

};

    window.flog2_form=flog2_form;
}();
