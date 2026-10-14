(() => {
  "use strict";

  const COLS=10, ROWS=16, FILES="ABCDEFGHIJ";
  const HUMAN_IDS=["P1","P2","P3","P4"];
  const COLORS={P1:"#7fbf7f",P2:"#ff9f1c",P3:"#ffd166",P4:"#8f79d8",CPU:"#d33a2c"};
  const back=["R","N","B","Q","K","B","N","R"];
  const PEER_OPTIONS={
    debug:1,
    config:{
      iceServers:[
        {urls:"stun:stun.l.google.com:19302"},
        {urls:"stun:openrelay.metered.ca:80"},
        {urls:"turn:openrelay.metered.ca:80",username:"openrelayproject",credential:"openrelayproject"},
        {urls:"turn:openrelay.metered.ca:443",username:"openrelayproject",credential:"openrelayproject"}
      ]
    }
  };

  let pieces=[], selected=null, legalTargets=[], currentHuman=0, gameOver=false, message="";
  let turnTransferred=false, lastCpuMove=null, cpuThinking=false;
  let mode="local", peer=null, hostConn=null, isHost=false, roomCode="";
  let connections=new Map(), participants=[], seatOwners={}, myParticipantId="local", gameStarted=false;

  const $=id=>document.getElementById(id);
  const isHuman=o=>HUMAN_IDS.includes(o);
  const inside=(r,c)=>r>=0&&r<ROWS&&c>=0&&c<COLS;
  const piece=(owner,type,r,c,dr=0,dc=0)=>({id:owner+"-"+type+"-"+r+"-"+c+"-"+Math.random().toString(36).slice(2,8),owner,type,r,c,dr,dc,moved:false,alive:true});
  const at=(r,c,arr=pieces)=>arr.find(p=>p.alive&&p.r===r&&p.c===c)||null;
  const enemy=(a,b)=>a==="CPU"?isHuman(b):isHuman(a)?b==="CPU":false;
  const kingOf=(owner,arr=pieces)=>arr.find(p=>p.alive&&p.owner===owner&&p.type==="K")||null;

  function cleanName(v){return (v||"Player").trim().slice(0,20)||"Player";}
  function makeCode(){return Math.random().toString(36).slice(2,8).toUpperCase();}
  function peerIdFor(code){return "chesscoop-"+code.toLowerCase();}

  function addArmy(owner,edge,start){
    if(edge==="top"){
      back.forEach((t,i)=>pieces.push(piece(owner,t,0,start+i,1,0)));
      for(let i=0;i<8;i++)pieces.push(piece(owner,"P",1,start+i,1,0));
    }else if(edge==="bottom"){
      back.forEach((t,i)=>pieces.push(piece(owner,t,15,start+i,-1,0)));
      for(let i=0;i<8;i++)pieces.push(piece(owner,"P",14,start+i,-1,0));
    }else if(edge==="left"){
      back.forEach((t,i)=>pieces.push(piece(owner,t,4+i,0,0,1)));
      for(let i=0;i<8;i++)pieces.push(piece(owner,"P",4+i,1,0,1));
    }else if(edge==="right"){
      back.forEach((t,i)=>pieces.push(piece(owner,t,4+i,9,0,-1)));
      for(let i=0;i<8;i++)pieces.push(piece(owner,"P",4+i,8,0,-1));
    }
  }

  function setupCPU(){
    for(let c=3;c<=6;c++) pieces.push(piece("CPU","P",3,c,-1,0));
    for(let c=3;c<=6;c++) pieces.push(piece("CPU","P",12,c,1,0));
    for(let r=4;r<=11;r++) pieces.push(piece("CPU","P",r,3,0,-1));
    for(let r=4;r<=11;r++) pieces.push(piece("CPU","P",r,6,0,1));

    const leftCore=["R","N","B","Q","K","B","N","R"];
    const rightCore=["R","N","B","Q",null,"B","N","R"];
    for(let i=0;i<8;i++){
      if(leftCore[i]) pieces.push(piece("CPU",leftCore[i],4+i,4));
      if(rightCore[i]) pieces.push(piece("CPU",rightCore[i],4+i,5));
    }
  }

  function resetState(){
    pieces=[];selected=null;legalTargets=[];currentHuman=0;gameOver=false;turnTransferred=false;lastCpuMove=null;cpuThinking=false;
    addArmy("P1","top",1);
    addArmy("P2","right",0);
    addArmy("P3","bottom",1);
    addArmy("P4","left",0);
    setupCPU();
    message="Select a P1 piece.";
  }

  function slideMoves(p,dirs,arr=pieces){
    const out=[];
    for(const [dr,dc] of dirs){
      let r=p.r+dr,c=p.c+dc;
      while(inside(r,c)){
        const q=at(r,c,arr);
        if(!q) out.push({r,c,capture:false});
        else { if(enemy(p.owner,q.owner)) out.push({r,c,capture:true}); break; }
        r+=dr;c+=dc;
      }
    }
    return out;
  }

  function rawMoves(p,arr=pieces){
    if(!p?.alive)return [];
    if(p.type==="R")return slideMoves(p,[[1,0],[-1,0],[0,1],[0,-1]],arr);
    if(p.type==="B")return slideMoves(p,[[1,1],[1,-1],[-1,1],[-1,-1]],arr);
    if(p.type==="Q")return slideMoves(p,[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],arr);
    if(p.type==="N"){
      return [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]
        .map(([dr,dc])=>({r:p.r+dr,c:p.c+dc}))
        .filter(x=>inside(x.r,x.c)&&(!at(x.r,x.c,arr)||enemy(p.owner,at(x.r,x.c,arr).owner)))
        .map(x=>({...x,capture:!!at(x.r,x.c,arr)}));
    }
    if(p.type==="K"){
      return [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
        .map(([dr,dc])=>({r:p.r+dr,c:p.c+dc}))
        .filter(x=>inside(x.r,x.c)&&(!at(x.r,x.c,arr)||enemy(p.owner,at(x.r,x.c,arr).owner)))
        .map(x=>({...x,capture:!!at(x.r,x.c,arr)}));
    }
    if(p.type==="P"){
      const out=[],fr=p.r+p.dr,fc=p.c+p.dc;
      if(inside(fr,fc)&&!at(fr,fc,arr)){
        out.push({r:fr,c:fc,capture:false});
        if(!p.moved){
          const fr2=p.r+p.dr*2,fc2=p.c+p.dc*2;
          if(inside(fr2,fc2)&&!at(fr2,fc2,arr))out.push({r:fr2,c:fc2,capture:false});
        }
      }
      const caps=p.dr!==0?[[p.dr,1],[p.dr,-1]]:[[1,p.dc],[-1,p.dc]];
      for(const [dr,dc] of caps){
        const r=p.r+dr,c=p.c+dc,q=inside(r,c)?at(r,c,arr):null;
        if(q&&enemy(p.owner,q.owner))out.push({r,c,capture:true});
      }
      return out;
    }
    return [];
  }

  const clonePieces=()=>pieces.map(p=>({...p}));
  function attackedByCPU(r,c,arr=pieces){return arr.filter(p=>p.alive&&p.owner==="CPU").some(p=>rawMoves(p,arr).some(m=>m.r===r&&m.c===c));}
  function attackedByHumans(r,c,arr=pieces){return arr.filter(p=>p.alive&&isHuman(p.owner)).some(p=>rawMoves(p,arr).some(m=>m.r===r&&m.c===c));}
  function inCheck(owner,arr=pieces){
    const k=kingOf(owner,arr); if(!k)return false;
    return owner==="CPU"?attackedByHumans(k.r,k.c,arr):attackedByCPU(k.r,k.c,arr);
  }
  function simulateMove(p,target){
    const arr=clonePieces(),cp=arr.find(x=>x.id===p.id);
    const victim=arr.find(x=>x.alive&&x.r===target.r&&x.c===target.c);
    if(victim)victim.alive=false;
    cp.r=target.r;cp.c=target.c;cp.moved=true;
    return arr;
  }
  function legalMoves(p){
    const raw=rawMoves(p);
    if(!isHuman(p.owner))return raw;
    return raw.filter(m=>!inCheck(p.owner,simulateMove(p,m)));
  }
  function hasLegalMove(owner){return pieces.filter(p=>p.alive&&p.owner===owner).some(p=>legalMoves(p).length);}
  function eliminateIfMated(){
    for(const owner of HUMAN_IDS){
      if(!kingOf(owner))continue;
      if(inCheck(owner)&&!hasLegalMove(owner)){
        pieces.forEach(p=>{if(p.owner===owner)p.alive=false;});
        message=owner+" was checkmated — that entire army is out.";
      }
    }
  }
  const cpuCount=()=>pieces.filter(p=>p.alive&&p.owner==="CPU").length;
  const humansAlive=()=>HUMAN_IDS.filter(o=>!!kingOf(o));
  function cpuKingPinned(){
    const k=kingOf("CPU"); if(!k)return false;
    return inCheck("CPU")&&!rawMoves(k).some(m=>!attackedByHumans(m.r,m.c,simulateMove(k,m)));
  }
  function finishChecks(){
    eliminateIfMated();
    if(!humansAlive().length){gameOver=true;message="CPU wins — every human army has been eliminated.";return;}
    const count=cpuCount();
    if(count===1&&cpuKingPinned()){gameOver=true;message="HUMANS WIN — the CPU army is destroyed and its king is checkmated.";return;}
    if(count>1&&cpuKingPinned())message="CPU KING PINNED — destroy the remaining "+(count-1)+" CPU piece"+(count-1===1?"":"s")+".";
  }

  function applyMove(p,m){
    const victim=at(m.r,m.c);
    if(victim?.type==="K"){message="Kings are never captured. Checkmate decides elimination.";return false;}
    if(victim)victim.alive=false;
    p.r=m.r;p.c=m.c;p.moved=true;
    if(p.type==="P"&&(p.r===0||p.r===ROWS-1||p.c===0||p.c===COLS-1)){
      p.type="Q";
      message=p.owner+" pawn promoted to a queen.";
    }
    selected=null;legalTargets=[];
    return true;
  }

  function advanceHuman(){
    for(let i=0;i<HUMAN_IDS.length;i++){
      currentHuman=(currentHuman+1)%HUMAN_IDS.length;
      if(kingOf(HUMAN_IDS[currentHuman])){message="Select a "+HUMAN_IDS[currentHuman]+" piece.";return;}
    }
  }

  function cpuMove(){
    if(!authority()||gameOver)return;
    cpuThinking=false;
    const cpu=pieces.filter(p=>p.alive&&p.owner==="CPU");
    if(!cpu.length)return;

    if(cpu.length===2){
      const aliveIndices=HUMAN_IDS.map((o,i)=>kingOf(o)?i:-1).filter(i=>i>=0);
      const lastAlive=Math.max(...aliveIndices);
      if(currentHuman!==lastAlive){
        message="CPU LAST STAND — CPU holds. Next surviving team moves.";
        advanceHuman();syncState();return;
      }
    }

    let candidates=[];
    for(const p of cpu){
      if(p.type==="K"&&cpu.length>1&&cpuKingPinned())continue;
      for(const m of rawMoves(p)){
        if(at(m.r,m.c)?.type==="K")continue;
        let score=(m.capture?20:0)+Math.random()*4;
        const target=at(m.r,m.c);
        if(target?.type==="Q")score+=10;
        if(target?.type==="R")score+=6;
        if(target?.type==="K")score+=100;
        candidates.push({p,m,score});
      }
    }
    if(cpu.length===1){
      const k=cpu[0];
      candidates=rawMoves(k)
        .filter(m=>!attackedByHumans(m.r,m.c,simulateMove(k,m)))
        .filter(m=>at(m.r,m.c)?.type!=="K")
        .map(m=>({p:k,m,score:(m.capture?20:0)+Math.random()*4}));
      if(!candidates.length){finishChecks();syncState();return;}
    }
    if(!candidates.length){message="CPU has no legal move.";finishChecks();syncState();return;}

    candidates.sort((a,b)=>b.score-a.score);
    const chosen=candidates[0];
    lastCpuMove={from:{r:chosen.p.r,c:chosen.p.c},to:{r:chosen.m.r,c:chosen.m.c}};
    applyMove(chosen.p,chosen.m);
    finishChecks();
    if(!gameOver)advanceHuman();
    syncState();
  }

  function authority(){return mode==="local"||isHost;}
  function currentTeam(){return HUMAN_IDS[currentHuman];}
  function myTeams(){
    if(mode==="local")return HUMAN_IDS.slice();
    return HUMAN_IDS.filter(t=>seatOwners[t]===myParticipantId);
  }
  function controls(team){return mode==="local"||seatOwners[team]===myParticipantId;}
  function participantName(id){return participants.find(p=>p.id===id)?.name||"Player";}

  function requestMove(pieceId,target){
    if(authority())return performMove(pieceId,target,myParticipantId);
    hostConn?.send({type:"moveRequest",pieceId,target});
  }
  function performMove(pieceId,target,senderId){
    if(!authority()||gameOver)return;
    const team=currentTeam();
    if(mode!=="local"&&seatOwners[team]!==senderId)return;
    const p=pieces.find(x=>x.alive&&x.id===pieceId);
    if(!p||p.owner!==team)return;
    const legal=legalMoves(p).find(m=>m.r===target.r&&m.c===target.c);
    if(!legal)return;
    if(applyMove(p,legal)){
      lastCpuMove=null;turnTransferred=false;finishChecks();
      if(!gameOver){cpuThinking=true;message="CPU is moving…";}
      syncState();
      if(!gameOver)setTimeout(cpuMove,500);
    }
  }

  function requestTransfer(targetOwner){
    if(authority())return performTransfer(targetOwner,myParticipantId);
    hostConn?.send({type:"transferRequest",targetOwner});
  }
  function performTransfer(targetOwner,senderId){
    if(!authority()||gameOver||turnTransferred||cpuThinking)return;
    const current=currentTeam();
    if(mode!=="local"&&seatOwners[current]!==senderId)return;
    if(inCheck(current)){message=current+" is in CHECK and must resolve it.";syncState();return;}
    const idx=HUMAN_IDS.indexOf(targetOwner);
    if(idx<0||targetOwner===current||!kingOf(targetOwner))return;
    currentHuman=idx;selected=null;legalTargets=[];turnTransferred=true;
    message="TURN GIVEN TO "+targetOwner+".";
    syncState();
  }

  function clickSquare(r,c){
    if(!gameStarted||gameOver||cpuThinking)return;
    const owner=currentTeam();
    if(!controls(owner)){message="Waiting for "+participantName(seatOwners[owner])+" ("+owner+") to move.";render();return;}
    const q=at(r,c);
    const target=legalTargets.find(m=>m.r===r&&m.c===c);
    if(selected&&target){requestMove(selected.id,target);return;}
    if(q&&q.owner===owner){
      selected=q;legalTargets=legalMoves(q);
      message=inCheck(owner)?owner+" is in CHECK — resolve it now.":owner+" selected "+q.type+".";
    }else{
      selected=null;legalTargets=[];message="It is "+owner+"'s turn.";
    }
    render();
  }

  function statePayload(){
    return {pieces,currentHuman,gameOver,message,turnTransferred,lastCpuMove,cpuThinking,seatOwners,participants};
  }
  function loadState(s){
    pieces=s.pieces||[];currentHuman=s.currentHuman||0;gameOver=!!s.gameOver;message=s.message||"";
    turnTransferred=!!s.turnTransferred;lastCpuMove=s.lastCpuMove||null;cpuThinking=!!s.cpuThinking;seatOwners=s.seatOwners||seatOwners;participants=s.participants||participants;
    selected=null;legalTargets=[];gameStarted=true;hideLobby();render();
  }
  function syncState(){
    render();
    if(isHost)broadcast({type:"state",state:statePayload()});
  }

  function broadcast(msg){
    for(const conn of connections.values())if(conn.open)try{conn.send(msg);}catch(_){}
  }

  function createPeer(requestedId){
    return new Peer(requestedId,PEER_OPTIONS);
  }

  function hostGame(){
    mode="online";isHost=true;roomCode=makeCode();myParticipantId=peerIdFor(roomCode);
    participants=[{id:myParticipantId,name:cleanName($("playerName").value),connected:true}];
    showRoomPanel();
    $("roomCodeDisplay").textContent=roomCode;
    $("connectionMessage").textContent="Creating room…";
    peer=createPeer(myParticipantId);

    peer.on("open",()=>{
      $("connectionMessage").textContent="Room ready. Share the code.";
      $("startGameBtn").classList.remove("hidden");
      renderParticipants();
    });
    peer.on("connection",conn=>{
      if(participants.length>=4){conn.on("open",()=>conn.send({type:"rejected",reason:"Room is full."}));return;}
      connections.set(conn.peer,conn);
      conn.on("data",data=>handleHostMessage(conn,data));
      conn.on("close",()=>{participants=participants.map(p=>p.id===conn.peer?{...p,connected:false}:p);broadcastLobby();renderParticipants();});
    });
    peer.on("error",e=>{$("connectionMessage").textContent="Connection error: "+friendlyPeerError(e);});
    setNetworkBadge();
  }

  function handleHostMessage(conn,data){
    if(!data||typeof data!=="object")return;
    if(data.type==="hello"){
      if(!participants.some(p=>p.id===conn.peer))participants.push({id:conn.peer,name:cleanName(data.name),connected:true});
      conn.send({type:"welcome",roomCode});
      broadcastLobby();renderParticipants();
    }else if(data.type==="moveRequest"){
      performMove(data.pieceId,data.target,conn.peer);
    }else if(data.type==="transferRequest"){
      performTransfer(data.targetOwner,conn.peer);
    }
  }

  function broadcastLobby(){broadcast({type:"lobby",participants});}

  function joinGame(){
    const code=($("roomCodeInput").value||"").trim().toUpperCase();
    if(code.length!==6){$("connectionMessage").textContent="Enter the 6-character room code.";showRoomPanel();return;}
    mode="online";isHost=false;roomCode=code;
    showRoomPanel();$("roomCodeDisplay").textContent=code;$("connectionMessage").textContent="Joining room…";
    peer=createPeer();
    let timer=setTimeout(()=>{$("connectionMessage").textContent="Still trying to connect… check the room code and network.";},12000);
    peer.on("open",id=>{
      myParticipantId=id;
      hostConn=peer.connect(peerIdFor(code),{serialization:"json"});
      hostConn.on("open",()=>{clearTimeout(timer);hostConn.send({type:"hello",name:cleanName($("playerName").value)});$("connectionMessage").textContent="Connected. Waiting for host.";});
      hostConn.on("data",handleGuestMessage);
      hostConn.on("close",()=>{$("connectionMessage").textContent="Host disconnected.";showRoomPanel();});
      hostConn.on("error",()=>{$("connectionMessage").textContent="Could not join the room.";});
    });
    peer.on("error",e=>{clearTimeout(timer);$("connectionMessage").textContent="Connection error: "+friendlyPeerError(e);});
    setNetworkBadge();
  }

  function handleGuestMessage(data){
    if(!data||typeof data!=="object")return;
    if(data.type==="rejected"){$("connectionMessage").textContent=data.reason||"Could not join.";return;}
    if(data.type==="lobby"){participants=data.participants||[];renderParticipants();}
    if(data.type==="welcome"){$("connectionMessage").textContent="Connected. Waiting for host to start.";}
    if(data.type==="start"||data.type==="state")loadState(data.state);
  }

  function friendlyPeerError(e){
    if(!e)return"unknown error";
    if(e.type==="peer-unavailable")return"room not found";
    if(e.type==="unavailable-id")return"room code collision — try hosting again";
    return e.type||e.message||"connection failed";
  }

  function assignTeams(){
    const active=participants.filter(p=>p.connected!==false);
    seatOwners={};
    HUMAN_IDS.forEach((team,i)=>seatOwners[team]=active[i%active.length].id);
  }

  function startOnlineGame(){
    if(!isHost)return;
    const active=participants.filter(p=>p.connected!==false);
    if(!active.length)return;
    participants=active;assignTeams();resetState();gameStarted=true;hideLobby();render();
    broadcast({type:"start",state:statePayload()});
    setNetworkBadge();
  }

  function startSolo(){
    mode="local";isHost=false;myParticipantId="local";participants=[{id:"local",name:cleanName($("playerName").value),connected:true}];
    seatOwners=Object.fromEntries(HUMAN_IDS.map(t=>[t,"local"]));
    resetState();gameStarted=true;hideLobby();render();setNetworkBadge();
  }

  function showRoomPanel(){$("lobbyHome").classList.add("hidden");$("roomPanel").classList.remove("hidden");}
  function hideLobby(){$("lobbyOverlay").classList.add("hidden");}
  function renderParticipants(){
    const box=$("participants"); if(!box)return;
    box.innerHTML=participants.map((p,i)=>'<div class="participant"><span class="avatar">'+(i+1)+'</span><strong>'+escapeHtml(p.name)+'</strong><span>'+(p.connected===false?'disconnected':'connected')+'</span></div>').join("");
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}

  function resetGame(){
    if(mode==="online"&&!isHost){message="Only the host can reset the game.";render();return;}
    resetState();gameStarted=true;syncState();
  }

  function setNetworkBadge(){
    const b=$("networkBadge");
    if(mode==="local"){b.textContent="LOCAL";b.className="network-badge";}
    else if(isHost){b.textContent="ONLINE • HOST";b.className="network-badge online";}
    else {b.textContent="ONLINE";b.className="network-badge online";}
  }

  function cpuMoveArrowChar(){
    if(!lastCpuMove)return "";
    const dr=Math.sign(lastCpuMove.to.r-lastCpuMove.from.r),dc=Math.sign(lastCpuMove.to.c-lastCpuMove.from.c);
    if(dr<0&&dc<0)return"↖";if(dr<0&&dc>0)return"↗";if(dr>0&&dc<0)return"↙";if(dr>0&&dc>0)return"↘";
    if(dr<0)return"↑";if(dr>0)return"↓";if(dc<0)return"←";if(dc>0)return"→";return"•";
  }

  function render(){
    const board=$("board");board.innerHTML="";
    const current=currentTeam();

    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      const sq=document.createElement("button");
      sq.className="square";
      sq.style.setProperty("--sq",(r+c)%2?"var(--dark)":"var(--light)");
      const p=at(r,c);
      if(r>=3&&r<=12&&c>=3&&c<=6)sq.classList.add("cpu-zone");
      if(selected?.r===r&&selected?.c===c)sq.classList.add("selected");
      const lm=legalTargets.find(m=>m.r===r&&m.c===c);if(lm)sq.classList.add(lm.capture?"capture":"legal");
      if(p?.type==="K"&&inCheck(p.owner))sq.classList.add("in-check");

      if(lastCpuMove?.from.r===r&&lastCpuMove?.from.c===c){
        sq.classList.add("cpu-from");
        const mark=document.createElement("span");mark.className="cpu-trace-arrow";mark.textContent=cpuMoveArrowChar();sq.appendChild(mark);
      }
      if(lastCpuMove?.to.r===r&&lastCpuMove?.to.c===c)sq.classList.add("cpu-to");

      if(p){
        if(p.owner===current&&!gameOver)sq.classList.add("current-piece");
        const sp=document.createElement("span");sp.className="piece "+(p.owner==="CPU"?"cpu":"");sp.textContent=p.type;
        sp.style.setProperty("--piece-color",p.owner==="CPU"?"#343b49":COLORS[p.owner]);
        sp.title=p.owner+" "+p.type;sq.setAttribute("aria-label",p.owner+" "+p.type+" at "+FILES[c]+(r+1));sq.appendChild(sp);
      }
      sq.addEventListener("click",()=>clickSquare(r,c));board.appendChild(sq);
    }

    $("turnLabel").textContent=gameOver?"—":current;
    $("cpuCount").textContent=cpuCount();
    $("checkLabel").textContent=kingOf(current)?(inCheck(current)?"CHECK":"Safe"):"Eliminated";
    $("message").textContent=message;

    $("legend").innerHTML=[...HUMAN_IDS,"CPU"].map(o=>{
      const owner=o==="CPU"?"CPU":participantName(seatOwners[o]);
      return '<span class="legend-chip '+(o===current&&!gameOver?'active':'')+'" style="--c:'+COLORS[o]+'"><i class="swatch" style="--c:'+COLORS[o]+'"></i><b>'+o+'</b><small>'+escapeHtml(owner)+'</small></span>';
    }).join("");

    const banner=$("turnBanner");
    banner.style.setProperty("--turn-color",COLORS[current]);
    $("turnDot").style.background=COLORS[current];
    $("turnBannerText").textContent=gameOver?"GAME OVER":current+" TURN";
    $("turnHint").textContent=gameOver?"":cpuThinking?"CPU MOVING…":controls(current)?"YOUR MOVE":"Waiting for "+participantName(seatOwners[current]);

    const pass=$("passTargets");
    if(pass){
      const blocked=inCheck(current)||turnTransferred||gameOver||cpuThinking||!controls(current);
      pass.innerHTML=HUMAN_IDS.filter(o=>o!==current&&kingOf(o)).map(o=>{
        const checked=inCheck(o);
        return '<button class="pass-target '+(checked?'check':'')+'" style="--c:'+COLORS[o]+'" data-pass="'+o+'" '+(blocked?'disabled':'')+'>'+o+(checked?' • CHECK':'')+'</button>';
      }).join("");
      pass.querySelectorAll("[data-pass]").forEach(btn=>btn.addEventListener("click",()=>requestTransfer(btn.dataset.pass)));
    }

    const mine=myTeams();
    $("seatSummary").textContent=mode==="local"?"Local test: you control all four teams":"You control: "+(mine.length?mine.join(", "):"spectator");
  }

  function setCellSize(px){$("boardWrap").style.setProperty("--cell",Math.max(24,Math.min(64,px))+"px");}
  function currentCellSize(){return parseFloat(getComputedStyle($("boardWrap")).getPropertyValue("--cell"))||42;}
  function fitBoard(){const usable=Math.max(280,$("boardWrap").clientWidth-32);setCellSize(Math.floor(usable/COLS));}
  function labels(){
    $("fileLabels").innerHTML=[...FILES].map(x=>"<span>"+x+"</span>").join("");
    $("rankLabels").innerHTML=Array.from({length:ROWS},(_,i)=>"<span>"+(i+1)+"</span>").join("");
  }

  $("hostGameBtn").addEventListener("click",hostGame);
  $("joinGameBtn").addEventListener("click",joinGame);
  $("soloBtn").addEventListener("click",startSolo);
  $("startGameBtn").addEventListener("click",startOnlineGame);
  $("copyRoomBtn").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(roomCode);$("copyRoomBtn").textContent="Copied";setTimeout(()=>$("copyRoomBtn").textContent="Copy",1200);}catch(_){}});
  $("roomCodeInput").addEventListener("input",e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6));
  $("resetBtn").addEventListener("click",resetGame);
  $("zoomOutBtn").addEventListener("click",()=>setCellSize(currentCellSize()-4));
  $("zoomInBtn").addEventListener("click",()=>setCellSize(currentCellSize()+4));
  $("fitBtn").addEventListener("click",fitBoard);
  window.addEventListener("resize",()=>{if(window.innerWidth<900)fitBoard();});

  labels();resetState();render();setNetworkBadge();
  setTimeout(()=>{if(window.innerWidth<900)fitBoard();},0);
})();