(() => {
  "use strict";
  const COLS=10, ROWS=16, FILES="ABCDEFGHIJ";
  const HUMAN_IDS=["P1","P2","P3","P4"];
  const COLORS={P1:"#7fbf7f",P2:"#ff9f1c",P3:"#ffd166",P4:"#8f79d8",CPU:"#d33a2c"};
  const GLYPH={K:"♚",Q:"♛",R:"♜",B:"♝",N:"♞",P:"♟"};
  const back=["R","N","B","Q","K","B","N","R"];

  let pieces=[], selected=null, legalTargets=[], currentHuman=0, gameOver=false, message="", turnTransferred=false, lastCpuMove=null;

  function piece(owner,type,r,c,dr=0,dc=0){return {id:owner+"-"+type+"-"+r+"-"+c+"-"+Math.random().toString(36).slice(2,7),owner,type,r,c,dr,dc,moved:false,alive:true};}
  function at(r,c,arr=pieces){return arr.find(p=>p.alive&&p.r===r&&p.c===c)||null;}
  function inside(r,c){return r>=0&&r<ROWS&&c>=0&&c<COLS;}
  function isHuman(o){return HUMAN_IDS.includes(o);}
  function allied(a,b){return isHuman(a)&&isHuman(b);}
  function enemy(a,b){if(a==="CPU")return isHuman(b);if(isHuman(a))return b==="CPU";return false;}

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
    // Compact four-player fortress: pawn shell + two-file core, one king total.
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

  function reset(){
    pieces=[];selected=null;legalTargets=[];currentHuman=0;gameOver=false;turnTransferred=false;lastCpuMove=null;
    addArmy("P1","top",1);
    addArmy("P2","right",0);
    addArmy("P3","bottom",1);
    addArmy("P4","left",0);
    setupCPU();
    message="Select a P1 piece.";
    render();
  }

  function slideMoves(p,dirs,arr=pieces,attackOnly=false){
    const out=[];
    for(const [dr,dc] of dirs){
      let r=p.r+dr,c=p.c+dc;
      while(inside(r,c)){
        const q=at(r,c,arr);
        if(!q) out.push({r,c,capture:false});
        else{if(enemy(p.owner,q.owner))out.push({r,c,capture:true});break;}
        r+=dr;c+=dc;
      }
    }
    return out;
  }
  function rawMoves(p,arr=pieces){
    if(!p.alive)return [];
    if(p.type==="R")return slideMoves(p,[[1,0],[-1,0],[0,1],[0,-1]],arr);
    if(p.type==="B")return slideMoves(p,[[1,1],[1,-1],[-1,1],[-1,-1]],arr);
    if(p.type==="Q")return slideMoves(p,[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],arr);
    if(p.type==="N"){
      return [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]].map(([dr,dc])=>({r:p.r+dr,c:p.c+dc})).filter(x=>inside(x.r,x.c)&&(!at(x.r,x.c,arr)||enemy(p.owner,at(x.r,x.c,arr).owner))).map(x=>({...x,capture:!!at(x.r,x.c,arr)}));
    }
    if(p.type==="K"){
      return [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].map(([dr,dc])=>({r:p.r+dr,c:p.c+dc})).filter(x=>inside(x.r,x.c)&&(!at(x.r,x.c,arr)||enemy(p.owner,at(x.r,x.c,arr).owner))).map(x=>({...x,capture:!!at(x.r,x.c,arr)}));
    }
    if(p.type==="P"){
      const out=[],fr=p.r+p.dr,fc=p.c+p.dc;
      if(inside(fr,fc)&&!at(fr,fc,arr)){
        out.push({r:fr,c:fc,capture:false});
        if(!p.moved){
          const fr2=p.r+(p.dr*2),fc2=p.c+(p.dc*2);
          if(inside(fr2,fc2)&&!at(fr2,fc2,arr))out.push({r:fr2,c:fc2,capture:false});
        }
      }
      const perps=p.dr!==0?[[p.dr,1],[p.dr,-1]]:[[1,p.dc],[-1,p.dc]];
      for(const [dr,dc] of perps){const r=p.r+dr,c=p.c+dc,q=inside(r,c)?at(r,c,arr):null;if(q&&enemy(p.owner,q.owner))out.push({r,c,capture:true});}
      return out;
    }
    return [];
  }

  function clonePieces(){return pieces.map(p=>({...p}));}
  function squareAttackedByCPU(r,c,arr=pieces){
    return arr.filter(p=>p.alive&&p.owner==="CPU").some(p=>rawMoves(p,arr).some(m=>m.r===r&&m.c===c));
  }
  function squareAttackedByHumans(r,c,arr=pieces){
    return arr.filter(p=>p.alive&&isHuman(p.owner)).some(p=>rawMoves(p,arr).some(m=>m.r===r&&m.c===c));
  }
  function kingOf(owner,arr=pieces){return arr.find(p=>p.alive&&p.owner===owner&&p.type==="K")||null;}
  function inCheck(owner,arr=pieces){
    const k=kingOf(owner,arr);if(!k)return false;
    return owner==="CPU"?squareAttackedByHumans(k.r,k.c,arr):squareAttackedByCPU(k.r,k.c,arr);
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
  function hasLegalMove(owner){
    return pieces.filter(p=>p.alive&&p.owner===owner).some(p=>legalMoves(p).length);
  }
  function eliminateIfMated(){
    for(const owner of HUMAN_IDS){
      const king=kingOf(owner);
      if(!king)continue;
      if(inCheck(owner)&&!hasLegalMove(owner)){
        pieces.forEach(p=>{if(p.owner===owner)p.alive=false;});
        message=owner+" was checkmated — their entire army has been removed.";
      }
    }
  }
  function cpuCount(){return pieces.filter(p=>p.alive&&p.owner==="CPU").length;}
  function cpuKingPinned(){
    const k=kingOf("CPU");if(!k)return false;
    return inCheck("CPU")&&!rawMoves(k).some(m=>!squareAttackedByHumans(m.r,m.c,simulateMove(k,m)));
  }
  function humansAlive(){return HUMAN_IDS.filter(o=>!!kingOf(o));}

  function finishChecks(){
    eliminateIfMated();
    if(!humansAlive().length){gameOver=true;message="CPU wins — every human army has been eliminated.";return;}
    const count=cpuCount();
    if(count===1&&cpuKingPinned()){gameOver=true;message="HUMANS WIN — the CPU army is destroyed and its king is checkmated.";return;}
    if(count>1&&cpuKingPinned())message="CPU KING PINNED — destroy the remaining "+(count-1)+" CPU piece"+(count-1===1?"":"s")+".";
  }

  function applyMove(p,m){
    const victim=at(m.r,m.c);
    if(victim&&victim.type==="K"){
      message="Kings are never captured. Checkmate decides elimination.";
      return false;
    }
    if(victim)victim.alive=false;
    p.r=m.r;p.c=m.c;p.moved=true;
    if(p.type==="P"&&(p.r===0||p.r===ROWS-1||p.c===0||p.c===COLS-1)){
      p.type="Q";
      message=p.owner+" pawn promoted to a queen.";
    }
    selected=null;legalTargets=[];
    return true;
  }

  function cpuMove(){
    if(gameOver)return;
    const cpu=pieces.filter(p=>p.alive&&p.owner==="CPU");
    if(!cpu.length)return;

    // Experimental "last stand" balance rule:
    // at king + one piece, CPU acts once per full surviving-human round rather than after every human move.
    if(cpu.length===2){
      const aliveIndices=HUMAN_IDS.map((o,i)=>kingOf(o)?i:-1).filter(i=>i>=0);
      const lastAlive=Math.max(...aliveIndices);
      if(currentHuman!==lastAlive){
        message="CPU LAST STAND — CPU holds. Next surviving player moves.";
        advanceHuman();
        render();
        return;
      }
    }

    // Boss rule: while other CPU pieces remain, CPU need not resolve a pinned king.
    let candidates=[];
    for(const p of cpu){
      if(p.type==="K"&&cpu.length>1&&cpuKingPinned())continue;
      for(const m of rawMoves(p)){
        if(at(m.r,m.c)?.type==="K")continue;
        let score=(m.capture?20:0)+Math.random()*4;
        const target=at(m.r,m.c);if(target?.type==="Q")score+=10;if(target?.type==="R")score+=6;if(target?.type==="K")score+=100;
        candidates.push({p,m,score});
      }
    }
    if(cpu.length===1){
      const k=cpu[0];
      candidates=rawMoves(k).filter(m=>!squareAttackedByHumans(m.r,m.c,simulateMove(k,m))).filter(x=>at(x.r,x.c)?.type!=="K").map(m=>({p:k,m,score:(m.capture?20:0)+Math.random()*4}));
      if(!candidates.length){finishChecks();render();return;}
    }
    if(!candidates.length){message="CPU has no legal move.";finishChecks();render();return;}
    candidates.sort((a,b)=>b.score-a.score);
    const chosen=candidates[0];
    lastCpuMove={from:{r:chosen.p.r,c:chosen.p.c},to:{r:chosen.m.r,c:chosen.m.c}};
    applyMove(chosen.p,chosen.m);
    finishChecks();
    if(!gameOver)advanceHuman();
    render();
  }

  function advanceHuman(){
    for(let i=0;i<HUMAN_IDS.length;i++){
      currentHuman=(currentHuman+1)%HUMAN_IDS.length;
      if(kingOf(HUMAN_IDS[currentHuman])){message="Select a "+HUMAN_IDS[currentHuman]+" piece.";return;}
    }
  }

  function transferTurn(targetOwner){
    if(gameOver||turnTransferred)return;
    const current=HUMAN_IDS[currentHuman];
    if(inCheck(current)){
      message=current+" is in CHECK and must resolve it before the turn can be given away.";
      render();
      return;
    }
    const idx=HUMAN_IDS.indexOf(targetOwner);
    if(idx<0||idx===currentHuman||!kingOf(targetOwner))return;
    currentHuman=idx;
    selected=null;
    legalTargets=[];
    turnTransferred=true;
    message="TURN GIVEN TO "+targetOwner+" — choose the team's move.";
    render();
  }

  function clickSquare(r,c){
    if(gameOver)return;
    const owner=HUMAN_IDS[currentHuman],q=at(r,c);
    const target=legalTargets.find(m=>m.r===r&&m.c===c);
    if(selected&&target){
      if(applyMove(selected,target)){lastCpuMove=null;turnTransferred=false;finishChecks();render();if(!gameOver)setTimeout(cpuMove,350);}
      return;
    }
    if(q&&q.owner===owner){
      selected=q;legalTargets=legalMoves(q);
      message=(inCheck(owner)?owner+" is in CHECK — this move must resolve it.":owner+" selected "+q.type+" — now tap a green square.");
    }else{
      selected=null;legalTargets=[];message="It is "+owner+"'s turn.";
    }
    render();
  }

  function render(){
    const board=document.getElementById("board");board.innerHTML="";
    const current=HUMAN_IDS[currentHuman];
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      const sq=document.createElement("button");sq.className="square";
      sq.style.setProperty("--sq",(r+c)%2?"var(--dark)":"var(--light)");
      const p=at(r,c);
      if(r>=3&&r<=12&&c>=3&&c<=6)sq.classList.add("cpu-zone");
      if(selected?.r===r&&selected?.c===c)sq.classList.add("selected");
      if(lastCpuMove?.from.r===r&&lastCpuMove?.from.c===c)sq.classList.add("cpu-from");
      if(lastCpuMove?.to.r===r&&lastCpuMove?.to.c===c)sq.classList.add("cpu-to");
      const lm=legalTargets.find(m=>m.r===r&&m.c===c);if(lm)sq.classList.add(lm.capture?"capture":"legal");
      if(p?.type==="K"&&inCheck(p.owner))sq.classList.add("in-check");
      if(p){
        if(p.owner===current&&!gameOver)sq.classList.add("current-piece");
        const sp=document.createElement("span");
        sp.className="piece "+(p.owner==="CPU"?"cpu":"");
        sp.textContent=p.type;
        sp.style.setProperty("--piece-color",p.owner==="CPU"?"#343b49":COLORS[p.owner]);
        sp.title=p.owner+" "+p.type;
        sq.setAttribute("aria-label",p.owner+" "+p.type+" at "+FILES[c]+(r+1));
        sq.appendChild(sp);
      }
      sq.addEventListener("click",()=>clickSquare(r,c));board.appendChild(sq);
    }
    document.getElementById("turnLabel").textContent=gameOver?"—":current+" → CPU";
    document.getElementById("cpuCount").textContent=cpuCount();
    document.getElementById("checkLabel").textContent=kingOf(current)?(inCheck(current)?"CHECK":"Safe"):"Eliminated";
    document.getElementById("message").textContent=message;

    const leg=document.getElementById("legend");
    leg.innerHTML=[...HUMAN_IDS,"CPU"].map(o=>'<span class="legend-chip '+(o===current&&!gameOver?'active':'')+'" style="--c:'+COLORS[o]+'"><i class="swatch" style="--c:'+COLORS[o]+'"></i>'+o+'</span>').join("");

    const banner=document.getElementById("turnBanner");
    banner.style.setProperty("--turn-color",COLORS[current]);
    document.getElementById("turnDot").style.background=COLORS[current];
    document.getElementById("turnBannerText").textContent=gameOver?"GAME OVER":current+" TURN";

    const arrow=document.getElementById("cpuMoveArrow");
    const line=document.getElementById("cpuArrowLine");
    if(arrow&&line){
      if(lastCpuMove){
        line.setAttribute("x1",lastCpuMove.from.c+0.72);
        line.setAttribute("y1",lastCpuMove.from.r+0.72);
        line.setAttribute("x2",lastCpuMove.to.c+0.28);
        line.setAttribute("y2",lastCpuMove.to.r+0.28);
        line.style.opacity="0.10";
      }else{
        line.style.opacity="0";
      }
    }

    const pass=document.getElementById("passTargets");
    if(pass){
      const blocked=inCheck(current)||turnTransferred||gameOver;
      pass.innerHTML=HUMAN_IDS.filter(o=>o!==current&&kingOf(o)).map(o=>{
        const checked=inCheck(o);
        return '<button class="pass-target '+(checked?'check':'')+'" style="--c:'+COLORS[o]+'" data-pass="'+o+'" '+(blocked?'disabled':'')+'>'+o+(checked?' • CHECK':'')+'</button>';
      }).join("");
      pass.querySelectorAll("[data-pass]").forEach(btn=>btn.addEventListener("click",()=>transferTurn(btn.dataset.pass)));
    }
  }

  function setCellSize(px){
    const wrap=document.getElementById("boardWrap");
    wrap.style.setProperty("--cell",Math.max(20,Math.min(64,px))+"px");
  }
  function fitBoard(){
    const wrap=document.getElementById("boardWrap");
    const usable=Math.max(320,wrap.clientWidth-34);
    setCellSize(Math.floor(usable/COLS));
  }
  function currentCellSize(){
    const v=getComputedStyle(document.getElementById("boardWrap")).getPropertyValue("--cell");
    return parseFloat(v)||42;
  }

  function labels(){
    document.getElementById("fileLabels").innerHTML=[...FILES].map(x=>"<span>"+x+"</span>").join("");
    document.getElementById("rankLabels").innerHTML=Array.from({length:ROWS},(_,i)=>"<span>"+(i+1)+"</span>").join("");
  }

  document.getElementById("resetBtn").addEventListener("click",reset);
  document.getElementById("cpuBtn").addEventListener("click",cpuMove);
  document.getElementById("zoomOutBtn").addEventListener("click",()=>setCellSize(currentCellSize()-4));
  document.getElementById("zoomInBtn").addEventListener("click",()=>setCellSize(currentCellSize()+4));
  document.getElementById("fitBtn").addEventListener("click",fitBoard);
  window.addEventListener("resize",()=>{if(window.innerWidth<800)fitBoard();});
  labels();reset();
  setTimeout(()=>{if(window.innerWidth<800)fitBoard();},0);
})();