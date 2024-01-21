var vid, playbtn, seekslider, curtimetext, durtimetext;

function initializePlayer(){

    vid = document.getElementById('my_video');
    playbtn = document.getElementById('play/pausebutton');
    seekslider = document.getElementById('seekslider');
    durtimetext = document.getElementById('durtimetext');
    curtimetext = document.getElementById('curtimetext');
    playbtn.addEventListener('click', playPause, false);
    seekslider.addEventListener ("change", vidSeek, false);
    vid.addEventListener ("timeupdate", seektimeupdate, false);

}

window.onload = initializePlayer;


function playPause(){

    if(vid.paused){
        vid.play();
        playbtn.innerHTML= 'Pause';

    }else{
        vid.pause();
        playbtn.innerHTML = 'Play';

    }

}

function vidSeek(){
    var seekto = vid.duration * (seekslider.value/100);
    vid.currentTime = seekto;

}

function seektimeupdate(){
    var nt = vid.currentTime * (100 / vid.duration);
    seekslider. value = nt;
    var curmins = Math.floor (vid.currentTime / 60);
    var cursecs = Math.floor (vid.currentTime - curmins * 60);
    var durmins = Math.floor (vid.duration / 60);
    var dursecs = Math.round(vid.duration - durmins * 60);
    if (cursecs < 10){
    cursecs = "0"+cursecs;
    }
    if (dursecs < 10){
    dursecs = "0"+dursecs;
    }
    curtimetext.innerHTML = curmins+":"+cursecs;
    durtimetext.innerHTML = durmins+":"+dursecs;

}