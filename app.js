(() => {
  "use strict";
  const COLS=17, ROWS=22, FILES="ABCDEFGHIJKLMNOPQ";
  const HUMAN_IDS=["P1","P2","P3","P4","P5","P6"];
  const COLORS={P1:"#ef476f",P2:"#f78c3d",P3:"#ffd166",P4:"#06d6a0",P5:"#36a2eb",P6:"#9b5de5",CPU:"#8c96a8"};
  const GLYPH={K:"♚",Q:"♛",R:"♜",B:"♝",N:"♞",P:"♟"};
  const back=["R","N","B","Q","K","B","N","R"];

  let pieces=[], selected=null, legalTargets=[], currentHuman=0, gameOver=false, message="";

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
      back.forEach((t,i)=>pieces.push(piece(owner,t,21,start+i,-1,0)));
      for(let i=0;i<8;i++)pieces.push(piece(owner,"P",20,start+i,-1,0));
    }else if(edge==="left"){
      back.forEach((t,i)=>pieces.push(piece(owner,t,7+i,0,0,1)));
      for(let i=0;i<8;i++)pieces.push(piece(owner,"P",7+i,1,0,1));
    }else if(edge==="right"){
      back.forEach((t,i)=>pieces.push(piece(owner,t,7+i,16,0,-1)));
      for(let i=0;i<8;i++)pieces.push(piece(owner,"P",7+i,15,0,-1));
    }
  }

  function setupCPU(){
    // Four outward pawn fronts. The four-square gaps are rows 2–5 / 16–19 and files 2–5 / 11–14.
    for(let c=6;c<=10;c++) pieces.push(piece("CPU","P",6,c,-1,0));
    for(let c=6;c<=10;c++) pieces.push(piece("CPU","P",15,c,1,0));
    for(let r=7;r<=14;r++) pieces.push(piece("CPU","P",r,6,0,-1));
    for(let r=7;r<=14;r++) pieces.push(piece("CPU","P",r,10,0,1));

    // Inner fortress: one king total; other major/minor pieces can scale with the boss.
    const core=[
      ["R",7,7],["N",7,8],["B",7,9],
      ["Q",9,7],["B",9,9],
      ["N",11,7],["K",11,8],["N",11,9],
      ["B",13,7],["Q",13,9],
      ["R",14,7],["N",14,8],["B",14,9]
    ];
    core.forEach(([t,r,c])=>pieces.push(piece("CPU",t,r,c)));
  }

  function reset(){
    pieces=[];selected=null;legalTargets=[];currentHuman=0;gameOver=false;
    addArmy("P1","top",0);addArmy("P2","top",9);
    addArmy("P3","right",0);
    addArmy("P4","bottom",9);addArmy("P5","bottom",0);
    addArmy("P6","left",0);
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
      if(inside(fr,fc)&&!at(fr,fc,arr))out.push({r:fr,c:fc,capture:false});
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
    if(p.type==="P"&&(p.r===0||p.r===ROWS-1||p.c===0||p.c===COLS-1))p.type="Q";
    selected=null;legalTargets=[];
    return true;
  }

  function cpuMove(){
    if(gameOver)return;
    const cpu=pieces.filter(p=>p.alive&&p.owner==="CPU");
    if(!cpu.length)return;
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
    applyMove(candidates[0].p,candidates[0].m);
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

  function clickSquare(r,c){
    if(gameOver)return;
    const owner=HUMAN_IDS[currentHuman],q=at(r,c);
    const target=legalTargets.find(m=>m.r===r&&m.c===c);
    if(selected&&target){
      if(applyMove(selected,target)){finishChecks();render();if(!gameOver)setTimeout(cpuMove,350);}
      return;
    }
    if(q&&q.owner===owner){
      selected=q;legalTargets=legalMoves(q);
      message=(inCheck(owner)?owner+" is in CHECK — this move must resolve it.":owner+" selected "+q.type+".");
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
      if(r>=6&&r<=15&&c>=6&&c<=10)sq.classList.add("cpu-zone");
      if(selected?.r===r&&selected?.c===c)sq.classList.add("selected");
      const lm=legalTargets.find(m=>m.r===r&&m.c===c);if(lm)sq.classList.add(lm.capture?"capture":"legal");
      if(p?.type==="K"&&inCheck(p.owner))sq.classList.add("in-check");
      if(p){
        const sp=document.createElement("span");sp.className="piece "+(p.owner==="CPU"?"cpu":"");sp.textContent=GLYPH[p.type];sp.style.color=p.owner==="CPU"?"#0c1018":COLORS[p.owner];sp.title=p.owner+" "+p.type;sq.appendChild(sp);
      }
      sq.addEventListener("click",()=>clickSquare(r,c));board.appendChild(sq);
    }
    document.getElementById("turnLabel").textContent=gameOver?"—":current+" → CPU";
    document.getElementById("cpuCount").textContent=cpuCount();
    document.getElementById("checkLabel").textContent=kingOf(current)?(inCheck(current)?"CHECK":"Safe"):"Eliminated";
    document.getElementById("message").textContent=message;

    const leg=document.getElementById("legend");leg.innerHTML=[...HUMAN_IDS,"CPU"].map(o=>'<span class="legend-chip"><i class="swatch" style="--c:'+COLORS[o]+'"></i>'+o+'</span>').join("");
  }

  function labels(){
    document.getElementById("fileLabels").innerHTML=[...FILES].map(x=>"<span>"+x+"</span>").join("");
    document.getElementById("rankLabels").innerHTML=Array.from({length:ROWS},(_,i)=>"<span>"+(i+1)+"</span>").join("");
  }

  document.getElementById("resetBtn").addEventListener("click",reset);
  document.getElementById("cpuBtn").addEventListener("click",cpuMove);
  labels();reset();
})();