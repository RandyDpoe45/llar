const math = require('mathjs')
const nj = require('numjs')
var cont=0;
var sound2;
var sound3;
var sound4;
var audioCtx = new (window.AudioContext || window.webkitAudioContext)();


function sign(input){
  if(input<0){
    return -1;
  }else if(input>0){
    return 1;
  }else{
    return 0;
  }
}

function allpass(x,g,d){
  var res=new Array(3);
  var b= new Array(d+1);
  var a= new Array(d+1);
  b[0]=g;b.fill(0,1,d);b[d]=1;
  a[0]=1;a.fill(0,1,d);a[d]=g;
  var y=filter(b,a,x);
  res[0]=y;
  res[1]=b;
  res[2]=a;
  return res;
}
function convolution(a,b){
  var y= new Array(a.length+b.length-1);
  y.fill(0);
  for(var i=0;i<a.length;i++){
    for(var j=0;j<b.length;j++){
      y[i+j]+=b[j]*a[i];
    }
  }
  return y;
}
function seriescoefficients(b1,a1,b,a){
  var res= new Array(2);
  res[0]=convolution(b1,b);
  res[1]=convolution(a1,a);
  return res;
}
function power1(a,b){
  var y=new Array(a.length);
  for(var i=0;i<a.length;i++){
    if(a[i]==0){
      y[i]=0;
    }else{
      y[i]=Math.pow(a[i],b);
    }
  }
  return y;
}
function filter(b,a,x){
    //https://stackoverflow.com/questions/8474854/matlab-filter-implementation
  if(a[0]!= 1.0 ){
    a=math.divide(a,a[0]);
    b=math.divide(b,a[0]);
  }
  var y= new Array(x.length);
  var input_size=x.length;
  var filter_order=Math.max(a.length,b.length);
  for(var i=(filter_order-a.length);i>0;i--){
    a.push(0);
  }
  for(var i=(filter_order-b.length);i>0;i--){
    b.push(0);
  }
  var zi=new Array(filter_order);
  zi.fill(0);

  for(var i=0;i<input_size;i++){
    var order=filter_order-1;
    while(order>0){
      if(i>=order){
        zi[order-1]= b[order]*x[i-order]-a[order]*y[i-order] + zi[order];
      }
      order--;
    }
    y[i]= b[0]*x[i] + zi[0];
  }

  return y;
}

function Float32Concat(first, second)
{
    var firstLength = first.length,
        result = new Float32Array(firstLength + second.length);

    result.set(first);
    result.set(second, firstLength);

    return result;
}

export class Llar{

  constructor () {
  this.sounds = [];
  }

 searchAudio(nombre){
    for(var i=0;i<this.sounds.length;i++){
      if(this.sounds[i].nombre==nombre){
        return this.sounds[i];
      }
    }
    return null;
  }

  changeOffset(nombre,offset){
    var au=this.searchAudio(nombre);
    au.offset=offset*au.datos.buffer.sampleRate;
  }

  replace(nombre,data){
    for(var i=0;i<this.sounds.length;i++){
      if(this.sounds[i].nombre==nombre){
        this.sounds[i].datos=data;
      }
    }
  }

  delete(nombre){
    var index;
    for(var i=0;i<this.sounds.length;i++){
      if(this.sounds[i].nombre==nombre){
        index=i;break;
      }
    }
    this.sounds.splice(index,1);
  }

  cut(nombres,ini,fin){
    var au=this.searchAudio(nombres[0]).datos;
    var inic=ini*au.buffer.sampleRate;
    var fi=fin*au.buffer.sampleRate;
    for(var i=0;i<nombres.length;i++){
      au=this.searchAudio(nombres[i]);
      var tt=au.datos;
      var sound8= audioCtx.createBufferSource();
      sound8.buffer= audioCtx.createBuffer(tt.buffer.numberOfChannels,tt.buffer.length-(fi-inic),tt.buffer.sampleRate);
      for (var j=0;j<tt.buffer.numberOfChannels;j++){
        var z=tt.buffer.getChannelData(j);
        var zz=sound8.buffer.getChannelData(j);
        for (var r=0,y=0;r<z.length;r++,y++){
          if(r==inic){
            r+=(fi-inic);
          }
          zz[y]=z[r];
        }
      }
      sound8.connect(audioCtx.destination);

      this.replace(au.nombre,sound8);
    }
  }

  duplicate(nombres){
    for(var i=0;i<nombres.length;i++){
      var au=this.searchAudio(nombres[i]);
      var tt=au.datos;
      var sound8= audioCtx.createBufferSource();
      sound8.buffer= audioCtx.createBuffer(tt.buffer.numberOfChannels,tt.buffer.length,tt.buffer.sampleRate);
      sound8.connect(audioCtx.destination);
      for(var j=0;j<tt.buffer.numberOfChannels;j++){
        sound8.buffer.copyToChannel(tt.buffer.getChannelData(j),j);
      }
      this.sounds.push({nombre:au.nombre+"copy",datos:sound8,offset:au.offset});
    }
  }

  join(nombres){
    var au=this.searchAudio(nombres[0]);
    var au2=this.searchAudio(nombres[1]);

    if(au.datos.buffer.numberOfChannels==au2.datos.buffer.numberOfChannels){

      var sound8= audioCtx.createBufferSource();
      sound8.buffer= audioCtx.createBuffer(au.datos.buffer.numberOfChannels,au.datos.buffer.length+au2.datos.buffer.length,au.datos.buffer.sampleRate);

      for(var j=0;j<au.datos.buffer.numberOfChannels;j++){
        var d= Float32Concat(au.datos.buffer.getChannelData(j),au2.datos.buffer.getChannelData(j));
        sound8.buffer.copyToChannel(d,j);
      }
      this.sounds.push({nombre:au.nombre,datos:sound8,offset:au.offset});

    }
  }

  combine(nombres){
    var min=Number.POSITIVE_INFINITY,max=0;var au;
    for(var i=0;i<nombres.length;i++){
      au=this.searchAudio(nombres[i]);
      if(au.offset<min){
        min=au.offset;
      }
      if(au.offset+au.datos.buffer.length>max){
        max=au.offset+au.datos.buffer.length;
      }
    }
    var sound8= audioCtx.createBufferSource();
    sound8.buffer= audioCtx.createBuffer(au.datos.buffer.numberOfChannels,max,au.datos.buffer.sampleRate);

    for(var i=0;i<nombres.length;i++){
      au=this.searchAudio(nombres[i]);
      for(var j=0;j<au.datos.buffer.numberOfChannels;j++){
        var z=sound8.buffer.getChannelData(j);
        var zz=au.datos.buffer.getChannelData(j);
        for(var y=0,p=au.offset-min;y<au.datos.buffer.length;y++,p++){
          z[p]+=zz[y];
        }
      }
    }
    this.sounds.push({nombre:"combinacion"+new String(cont),datos:sound8,offset:min});

  }

  buildGroup(nombres,fin){
    var au= this.searchAudio(nombres[0]);
    var soundF= audioCtx.createBufferSource();
   soundF.buffer= audioCtx.createBuffer(au.datos.buffer.numberOfChannels,fin*au.datos.buffer.sampleRate,au.datos.buffer.sampleRate);

    for(var i=0;i<nombres.length;i++){
      au=this.searchAudio(nombres[i]);
      for(var j=0;j<au.datos.buffer.numberOfChannels;j++){
        var z=soundF.buffer.getChannelData(j);
        var zz=au.datos.buffer.getChannelData(j);
        for(var y=0,p=au.offset;y<au.datos.buffer.length;y++,p++){
          z[p]+=zz[y];
        }
      }
    }
    soundF.connect(audioCtx.destination);
    return [soundF, audioCtx];

  }

  playGroup(nombres,fin){
    let sound8 = this.buildGroup(nombres, fin);
    sound8.start(0)
  }

  playSound(nombre){
    var pista=this.searchAudio(nombre);
    if(pista!=null){
      sound3= audioCtx.createBufferSource();
      sound3.buffer=pista.datos.buffer;
      sound3.connect(audioCtx.destination);
      sound3.start(0);
    }
  }
  stopCurrentSound(){
    if(sound3!=null){
    sound3.stop(0);
  }
  }

  delay(nombre,time,inicio,fin,veces,volume,appl){
    var pista=this.searchAudio(nombre);
    sound2=pista.datos;
    var space= Math.floor(sound2.buffer.sampleRate*time);
    var sub=1/veces;

    for (var j=0;j<sound2.buffer.numberOfChannels;j++){
      var z=sound2.buffer.getChannelData(j);
      var mody=z.slice(inicio*sound2.buffer.sampleRate,fin*sound2.buffer.sampleRate+space*veces);
      for(var i=0,w=inicio*sound2.buffer.sampleRate;i<fin*sound2.buffer.sampleRate;w+=space,i+=space){
        var t=z.slice(w,w+space);
        var aux=w;
        for(var o=0,ii=1;o<veces;o++,ii-=sub){
          for(var p=aux,y=0;y<space;p++,y++){
            mody[p]=mody[p]+t[y]*ii;
          }
          aux+=space;
        }

      }
      if(appl){
        var zz=sound3.buffer.getChannelData(j);
        for(var r=0,rr=inicio*sound2.buffer.sampleRate;r<mody.length;r++,rr++){
          zz[r]+=mody[r]*volume;
        }
      }else{
      for(var r=0,rr=inicio*sound2.buffer.sampleRate;r<mody.length;r++,rr++){
        z[rr]=mody[r]*volume;
      }
    }
    }

}
  showDelay(nombres,time,inicio,fin,veces,volume){
    var au=this.searchAudio(nombres[0]).datos;
    var space= Math.floor(au.buffer.sampleRate*time);
    sound3= audioCtx.createBufferSource();
    sound3.buffer= audioCtx.createBuffer(au.buffer.numberOfChannels,fin*au.buffer.sampleRate+space*veces-inicio*au.buffer.sampleRate,au.buffer.sampleRate);
    for(var i=0;i<nombres.length;i++){
        this.delay(nombres[i],time,inicio,fin,veces,volume,true);
    }
    sound3.connect(audioCtx.destination);
    sound3.start(0);
  }

  applyDelay(nombres,time,inicio,fin,veces,volume){
    for(var i=0;i<nombres.length;i++){
        this.delay(nombres[i],time,inicio,fin,veces,volume,false);
    }
  }

 ping_pong_delay(nombre,time,inicio,fin,veces,volume,appl){
  var pista=this.searchAudio(nombre);
  sound2=pista.datos;
  var space= Math.floor(sound2.buffer.sampleRate*time);
  var sub=1/veces;

  var offset=0;
  for (var j=0;j<sound2.buffer.numberOfChannels;j++){
    var z=sound2.buffer.getChannelData(j);
    var mody=z.slice(inicio*sound2.buffer.sampleRate,fin*sound2.buffer.sampleRate+space*veces);
    for(var i=0,w=inicio*sound2.buffer.sampleRate;i<fin*sound2.buffer.sampleRate;w+=space,i+=space){
      var t=z.slice(w,w+space);
      var aux=w;
      for(var o=0,ii=1;o<veces;o++,ii-=sub){
        for(var p=aux,y=0;y<space;p++,y++){
          mody[p]=mody[p]+t[y]*ii;
        }
        aux+=space;
      }

    }
    if(appl){
      var zz=sound3.buffer.getChannelData(j);
      for(var r=0,rr=offset;r<mody.length;r+=space,rr+=space){
        for(var t=0;t<space;t++,r++,rr++){
            zz[rr]+=mody[r]*volume;
        }
      }
    }else{
    for(var r=offset,rr=inicio*sound2.buffer.sampleRate+offset;r<mody.length;r+=space,rr+=space){
      for(var t=0;t<space;t++,r++,rr++){
          z[rr]=mody[r]*volume;
      }

    }
    }
    offset=space;
  }

}

  showPingPongDelay(nombres,time,inicio,fin,veces,volume){
    var au=this.searchAudio(nombres[0]).datos;
    var space= Math.floor(au.buffer.sampleRate*time);
    sound3= audioCtx.createBufferSource();
    sound3.buffer= audioCtx.createBuffer(au.buffer.numberOfChannels,fin*au.buffer.sampleRate+space*veces-inicio*au.buffer.sampleRate,au.buffer.sampleRate);
    for(var i=0;i<nombres.length;i++){
        this.ping_pong_delay(nombres[i],time,inicio,fin,veces,volume,true);
    }

    sound3.connect(audioCtx.destination);
    sound3.start(0);
  }

  applyPingPongDelay(nombres,time,inicio,fin,veces,volume){
    for(var i=0;i<nombres.length;i++){
        this.ping_pong_delay(nombres[i],time,inicio,fin,veces,volume,false);
    }
  }

  crescendo(nombre,inicio,fin,limin,limsu,volume,appl){
    var pista=this.searchAudio(nombre);
    sound2=pista.datos;
    var ini=inicio*sound2.buffer.sampleRate;
    var fi=fin*sound2.buffer.sampleRate;
    var incremento=(limsu-limin)/(fi-ini);
    for (var j=0;j<sound2.buffer.numberOfChannels;j++){

      var z=sound2.buffer.getChannelData(j);
      if(appl){
        var zz=sound3.buffer.getChannelData(j);
        for (var p=ini,t=0,i=limin;p<fi;p++,t++,i+=incremento){
          zz[t]+=z[p]*i*volume;
        }
      }else{
        for (var p=ini,i=limin;p<fi;p++,i+=incremento){
          z[p]=z[p]*i*volume;
        }
      }
    }
  }
  showCrescendo(nombres,inicio,fin,limin,limsu,volume){
    var au=this.searchAudio(nombres[0]).datos;
    sound3= audioCtx.createBufferSource();
    sound3.buffer= audioCtx.createBuffer(au.buffer.numberOfChannels,fin*au.buffer.sampleRate-inicio*au.buffer.sampleRate,au.buffer.sampleRate);
    for(var i=0;i<nombres.length;i++){
        this.crescendo(nombres[i],inicio,fin,limin,limsu,volume,true);
    }

    sound3.connect(audioCtx.destination);
    sound3.start(0);
  }
  applyCrescendo(nombres,inicio,fin,limin,limsu,volume){
    for(var i=0;i<nombres.length;i++){
        this.crescendo(nombres[i],inicio,fin,limin,limsu,volume,false);
    }
  }

  decrescendo(nombre,inicio,fin,limin,limsu,volume,appl){
    var pista=this.searchAudio(nombre);
    sound2=pista.datos;
    var ini=inicio*sound2.buffer.sampleRate;
    var fi=fin*sound2.buffer.sampleRate;

    var incremento=Math.abs(limsu-limin)/(fi-ini);
    for (var j=0;j<sound2.buffer.numberOfChannels;j++){
      var z=sound2.buffer.getChannelData(j);
      if(appl){
        var zz=sound3.buffer.getChannelData(j);
        for (var p=ini,t=0,i=limsu;p<fi;p++,t++,i-=incremento){
          zz[t]+=z[p]*i*volume;
        }
      }else{
      for (var p=ini,i=limsu;p<fi;p++,i-=incremento){
        z[p]=z[p]*i*volume;
      }
    }
    }
  }
  showDecrescendo(nombres,inicio,fin,limin,limsu,volume){
    var au=this.searchAudio(nombres[0]).datos;
    sound3= audioCtx.createBufferSource();
    sound3.buffer= audioCtx.createBuffer(au.buffer.numberOfChannels,fin*au.buffer.sampleRate-inicio*au.buffer.sampleRate,au.buffer.sampleRate);
    for(var i=0;i<nombres.length;i++){
        this.decrescendo(nombres[i],inicio,fin,limin,limsu,volume,true);
    }

    sound3.connect(audioCtx.destination);
    sound3.start(0);
  }
  applyDecrescendo(nombres,inicio,fin,limin,limsu,volume){
    for(var i=0;i<nombres.length;i++){
        this.decrescendo(nombres[i],inicio,fin,limin,limsu,volume,false);
    }
  }

  distortion(nombre,inicio,fin,volume,gain,mix,appl){
    var pista=this.searchAudio(nombre);
    sound2=pista.datos;
    var ini=inicio*sound2.buffer.sampleRate;
    var fi=fin*sound2.buffer.sampleRate;

    for (var j=0;j<sound2.buffer.numberOfChannels;j++){
      var z=sound2.buffer.getChannelData(j);
      var a=Array.from(z.slice(ini,fi));
      var q=nj.divide(a,math.max(math.abs(a)));
      var ss=nj.negative(a.map(sign));
      var z=nj.multiply(ss,nj.subtract(nj.ones(ss.size),nj.exp(nj.multiply(ss,nj.multiply(a,gain)))));
      var y=nj.divide(nj.multiply(nj.multiply(z,math.max(math.abs(a))),mix),math.max(math.abs(a)));

      var yy= nj.add(y,nj.multiply(a,(1-mix)));
      yy=nj.divide(nj.multiply(yy,math.max(math.abs(a))),math.max(math.abs(yy.selection.data)));
      if(appl){
        var zz=sound3.buffer.getChannelData(j);
        for (var p=ini,t=0;p<fi;p++,t++){
          zz[t]+=yy.get(t)*volume;

        }
      }else{
        var r=sound2.buffer.getChannelData(j);
        for (var p=ini,t=0;p<fi;p++,t++){
          r[p]=Number.parseFloat(yy.get(t)*volume);
        }
      }
    }
  }
  showDistorion(nombres,inicio,fin,volume,gain,mix){
    var au=this.searchAudio(nombres[0]).datos;
    sound3= audioCtx.createBufferSource();
    sound3.buffer= audioCtx.createBuffer(au.buffer.numberOfChannels,fin*au.buffer.sampleRate-inicio*au.buffer.sampleRate,au.buffer.sampleRate);
    for(var i=0;i<nombres.length;i++){
        this.distortion(nombres[i],inicio,fin,volume,gain,mix,true);
    }

    sound3.connect(audioCtx.destination);
    sound3.start(0);
  }
  applyDistortion(nombres,inicio,fin,volume,gain,mix){
    console.log("holito");
    for(var i=0;i<nombres.length;i++){
        this.distortion(nombres[i],inicio,fin,volume,gain,mix,false);
    }
  }

 overdrive(nombre,inicio,fin,volume,high,mid,low,appl){
   var pista=this.searchAudio(nombre);
   sound2=pista.datos;
  var ini=inicio*sound2.buffer.sampleRate;
  var fi=fin*sound2.buffer.sampleRate;

  for (var j=0;j<sound2.buffer.numberOfChannels;j++){
    var z=sound2.buffer.getChannelData(j);
    if(appl){
      var zz=sound3.buffer.getChannelData(j);

      for (var p=ini,t=0;p<fi;p++,t++){
        if(Math.abs(z[p])<1/3){
          zz[t]+=low*2*Math.abs(z[p]);
        }else if(Math.abs(z[p])>=1/3 ){
          if(z[p]>0){
            zz[t]+=mid*(3-((2-3*z[p])*(2-3*z[p])))/3;
          }else{
            zz[t]+=mid*(3-((2-3*Math.abs(z[p]))*(2-3*Math.abs(z[p]))))/3;
          }
        }else if(Math.abs(z[p])>=2/3){
          if(z[p]>0){
            zz[t]+=1*high;
          }else{
            zz[t]+=-1*high;
          }
        }

      }
    }else{
      var r=sound2.buffer.getChannelData(j);
    for (var p=ini;p<fi;p++){
      if(Math.abs(z[p])<1/3){
        z[p]=low*2*Math.abs(z[p]);
      }else if(Math.abs(z[p])>=1/3 ){
        if(z[p]>0){
          z[p]=mid*(3-((2-3*z[p])*(2-3*z[p])))/3;
        }else{
          z[p]=-mid*(3-((2-3*Math.abs(z[p]))*(2-3*Math.abs(z[p]))))/3;
        }
      }else if(Math.abs(z[p])>=2/3){
        if(z[p]>0){
          z[p]=high*1;
        }else{
          z[p]=-high*1;
        }
      }
    }
  }
  }
  }
  showOverdrive(nombres,inicio,fin,volume,high,mid,low){
    var au=this.searchAudio(nombres[0]).datos;
    sound3= audioCtx.createBufferSource();
    sound3.buffer= audioCtx.createBuffer(au.buffer.numberOfChannels,fin*au.buffer.sampleRate-inicio*au.buffer.sampleRate,au.buffer.sampleRate);
    for(var i=0;i<nombres.length;i++){
        this.overdrive(nombres[i],inicio,fin,volume,high,mid,low,true);
    }

    sound3.connect(audioCtx.destination);
    sound3.start(0);
  }

  applyOverdrive(nombres,inicio,fin,volume,high,mid,low){
    for(var i=0;i<nombres.length;i++){
        this.overdrive(nombres[i],inicio,fin,volume,high,mid,low,false);
    }
  }

  flanger(nombre,inicio,fin,volume,time,rate,amp,appl){
    var pista=this.searchAudio(nombre);
    sound2=pista.datos;
    var ini=Math.floor(inicio*sound2.buffer.sampleRate);
    var fi=Math.floor(fin*sound2.buffer.sampleRate);
    var space=Math.floor(time*sound2.buffer.sampleRate);
    var index=nj.arange(0,fi-ini);
    index=nj.multiply(Array.from(index.selection.data),2*Math.PI*(rate/sound2.buffer.sampleRate));
    var sin_ref=nj.sin(index);

    for (var j=0;j<sound2.buffer.numberOfChannels;j++){
      var z=sound2.buffer.getChannelData(j);
      if(appl){
        var zz=sound3.buffer.getChannelData(j);
        for(var i=0,t=ini;i<space;i++,t++){
          zz[i]+=z[t];
        }
        var cur_sin,cur_delay;
        for(var jj=ini+space,tt=space;jj<fi;jj++,tt++){
          cur_sin=Math.abs(sin_ref.selection.data[tt]);
          cur_delay=Math.ceil(cur_sin*space);
          zz[tt]+=(amp*z[jj])+amp*(z[jj-cur_delay]);
        }
      }
      else{
        var cur_sin,cur_delay;
        for(var jj=ini+space,tt=space;jj<fi;jj++,tt++){
          cur_sin=Math.abs(sin_ref.selection.data[tt]);
          cur_delay=Math.ceil(cur_sin*space);
          z[jj]=amp*(z[jj])+amp*(z[jj-cur_delay]);
        }
      }
    }

  }

  showFlanger(nombres,inicio,fin,volume,time,rate,amp){
    var au=this.searchAudio(nombres[0]).datos;
    console.log(this.searchAudio(nombres[0]).nombre);
    sound3= audioCtx.createBufferSource();
    sound3.buffer= audioCtx.createBuffer(au.buffer.numberOfChannels,fin*au.buffer.sampleRate-inicio*au.buffer.sampleRate,au.buffer.sampleRate);
    for(var i=0;i<nombres.length;i++){
        this.flanger(nombres[i],inicio,fin,volume,time,rate,amp,true);
    }

    sound3.connect(audioCtx.destination);
    sound3.start(0);
  }
  applyFlanger(nombres,inicio,fin,volume,time,rate,amp){
    for(var i=0;i<nombres.length;i++){
      this.flanger(nombres[i],inicio,fin,volume,time,rate,amp,false);
    }
  }

  stereo_panner(nombre,inicio,fin,volume,segments,initial_angle,final_angle,appl){
    var pista=this.searchAudio(nombre);
    sound2=pista.datos;
    var ini=Math.floor(inicio*sound2.buffer.sampleRate);
    var fi=Math.floor(fin*sound2.buffer.sampleRate);
    var signal= new Array(fi-ini).fill(0);
    for(var l=0;l<sound2.buffer.numberOfChannels;l++){
    var z=sound2.buffer.getChannelData(l);
      for(var i=0,t=ini;i<signal.length;i++,t++){
        signal[i]+=z[t];
      }
    }
    var angle_increment =(initial_angle - final_angle)/segments * Math.PI /180;
    var lenseg=Math.ceil((fi-ini)/segments);
    var pointer = 0;
    var angle =initial_angle * Math.PI/180;
    var y=[new Array(0),new Array(0)];
    for (var i=0;i<segments;i++){
      var a=[[Math.cos(angle),Math.sin(angle)],[-1*Math.sin(angle),Math.cos(angle)]];
      var stereo= signal.slice(pointer,pointer+lenseg);
      var stereox=[stereo,stereo];
      var res=math.multiply(a,stereox);
      y[0]=y[0].concat(res[0]);
      y[1]=y[1].concat(res[1]);
      pointer+=lenseg;
      angle+=angle_increment;
    }
    if(appl){
      var z=sound3.buffer.getChannelData(0);
      var z1=sound3.buffer.getChannelData(1);
      for(var i=0;i<y[0].length;i++){
        z[i]+=volume*y[0][i];
        z1[i]+=volume*y[1][i];
      }
    }else{
      var z=sound2.buffer.getChannelData(0);
      var z1=sound2.buffer.getChannelData(1);
      for(var i=0,t=ini;i<y[0].length;i++,t++){
        z[t]=volume*y[0][i];
        z1[t]=volume*y[1][i];
      }
    }

  }

  showStereoPanner(nombres,inicio,fin,volume,segments,initial_angle,final_angle){
    var au=this.searchAudio(nombres[0]).datos;
    sound3= audioCtx.createBufferSource();
    sound3.buffer= audioCtx.createBuffer(au.buffer.numberOfChannels,fin*au.buffer.sampleRate-inicio*au.buffer.sampleRate,au.buffer.sampleRate);
    for(var i=0;i<nombres.length;i++){
        this.stereo_panner(nombres[i],inicio,fin,volume,segments,initial_angle,final_angle,true);
    }
    sound3.connect(audioCtx.destination);
    sound3.start(0);
  }

  applyStereoPanner(nombres,inicio,fin,volume,segments,initial_angle,final_angle){
    for(var i=0;i<nombres.length;i++){
        this.stereo_panner(nombres[i],inicio,fin,volume,segments,initial_angle,final_angle,false);
    }
  }

  ringModulator(nombre,inicio,fin,volume,minf,maxf,delta,appl){
    var pista=this.searchAudio(nombre);
    sound2=pista.datos;
    var ini=Math.floor(inicio*sound2.buffer.sampleRate);
    var fi=Math.floor(fin*sound2.buffer.sampleRate);

    var trem= new Array(0);
    var len=(maxf-minf)/delta;
    while(trem.length<fi-ini){
      for(var i=maxf;i>=minf;i-=delta){
        trem.push(i);
      }
      for(var i=minf;i<maxf;i+=delta){
        trem.push(i);
      }
    }
    trem=trem.slice(0,fi-ini);

    for(var j=0;j<sound2.buffer.numberOfChannels;j++){
      var z=sound2.buffer.getChannelData(j);
      if(appl){
        var zz=sound3.buffer.getChannelData(j);
        for(var i=0,tt=ini;tt<fi;i++,tt++){
          zz[i]+=z[tt]*trem[i]*volume;
        }
      }else{
        for(var i=0,tt=ini;tt<fi;i++,tt++){
          z[tt]=z[tt]*trem[i]*volume;
        }
      }
    }

  }
  showRingModulator(nombres,inicio,fin,volume,minimum,maximum,delta){
    var au=this.searchAudio(nombres[0]).datos;
    sound3= audioCtx.createBufferSource();
    sound3.buffer= audioCtx.createBuffer(au.buffer.numberOfChannels,fin*au.buffer.sampleRate-inicio*au.buffer.sampleRate,au.buffer.sampleRate);
    for(var i=0;i<nombres.length;i++){
        this.ringModulator(nombres[i],inicio,fin,volume,minimum,maximum,delta,true);
    }
    sound3.connect(audioCtx.destination);
    sound3.start(0);
  }
  applyRingModulator(nombres,inicio,fin,volume,minimum,maximum,delta){
    for(var i=0;i<nombres.length;i++){
        this.ringModulator(nombres[i],inicio,fin,volume,minimum,maximum,delta,false);
    }
  }

  compressor(nombre,inicio,fin,volume,comp,a,appl){
    var pista=this.searchAudio(nombre);
    sound2=pista.datos;
    var ini=Math.floor(inicio*sound2.buffer.sampleRate);
    var fi=Math.floor(fin*sound2.buffer.sampleRate);
    for(var j=0;j<sound2.buffer.numberOfChannels;j++){

      var z=sound2.buffer.getChannelData(j);
      var x=Array.from(z.slice(ini,fi));
      var h=filter([(1-a)*(1-a)],[1, -2*a, a*a],math.abs(x));
      h=nj.divide(h,nj.max(h)).selection.data;
      h=power1(h,comp);
      var y= nj.multiply(x,h).selection.data;var t=math.max(math.abs(x))/math.max(math.abs(y));
      y = nj.multiply(y,t).selection.data;

      if(appl){
        var zz= sound3.buffer.getChannelData(j);
        for(var i=0;i<x.length;i++){
          zz[i]=volume*y[i];
        }
      }else{
        for(var i=0,tt=ini;i<x.length;i++,tt++){
          z[tt]=volume*y[i];
        }
      }
    }
  }
  showCompressor(nombres,inicio,fin,volume,comp,a){
    var au=this.searchAudio(nombres[0]).datos;
    sound3= audioCtx.createBufferSource();
    sound3.buffer= audioCtx.createBuffer(au.buffer.numberOfChannels,fin*au.buffer.sampleRate-inicio*au.buffer.sampleRate,au.buffer.sampleRate);
    for(var i=0;i<nombres.length;i++){
        this.compressor(nombres[i],inicio,fin,volume,comp,a,true);
    }
    sound3.connect(audioCtx.destination);
    sound3.start(0);
  }
  applyCompressor(nombres,inicio,fin,volume,comp,a){
    for(var i=0;i<nombres.length;i++){
        this.compressor(nombres[i],inicio,fin,volume,comp,a,false);
    }
  }

  reverb(nombre,inicio,fin,volume,nAll,gainA,k,appl){
    var pista=this.searchAudio(nombre);
    sound2=pista.datos;
    var ini=Math.floor(inicio*sound2.buffer.sampleRate);
    var fi=Math.floor(fin*sound2.buffer.sampleRate);
    var d= nj.multiply(nj.random(nAll),0.2);
    d= nj.round(nj.multiply(d,sound2.buffer.sampleRate*0.05)).selection.data;

    for(var j=0;j<sound2.buffer.numberOfChannels;j++){
      var x=Array.from(sound2.buffer.getChannelData(j).slice(ini,fi));
      var res=allpass(x,gainA,d[0]);
      var b=res[1],a=res[2],y=res[0];
      for(var i=1;i<nAll;i++){
        var res1=allpass(y,gainA,d[i]);
        var coef=seriescoefficients(res1[1],res1[2],b,a);
        a=coef[1];b=coef[0];
        y=res1[0];
      }

      var mm=math.max(y);
      if(appl){
        var zz=sound3.buffer.getChannelData(j);
        for(var i=0;i<y.length;i++){
          zz[i]=y[i]/mm;
        }

      }

    }

  }

  showReverb(nombres,inicio,fin,volume,nAll,gainA,k){
    var au=this.searchAudio(nombres[0]).datos;
    sound3= audioCtx.createBufferSource();
    sound3.buffer= audioCtx.createBuffer(au.buffer.numberOfChannels,fin*au.buffer.sampleRate-inicio*au.buffer.sampleRate,au.buffer.sampleRate);
    for(var i=0;i<nombres.length;i++){
        this.reverb(nombres[i],inicio,fin,volume,nAll,gainA,k,true);
    }
    sound3.connect(audioCtx.destination);
    sound3.start(0);
  }
  processConcatenatedFile( name,data ) {
    var  sound = audioCtx.createBufferSource();

    audioCtx.decodeAudioData(data, function(buffer) {

          sound.buffer = buffer;
          sound.connect(audioCtx.destination);

        },  function(e){ console.log("Error with decoding audio data" + e.err); });

        this.sounds.push({nombre:name,datos:sound,offset:0});
        console.log((this.sounds).length);
        console.log(name);

  }



}
