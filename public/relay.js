/* Lightweight PeerJS-compatible WebSocket relay adapter.
 * All game messages remain unchanged; only the transport is replaced.
 */
(() => {
  'use strict';
  const OPEN = 1;
  const WS_URL = () => `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
  const randomId = (prefix='p') => `${prefix}-${Math.random().toString(36).slice(2,8)}-${Date.now().toString(36)}`;

  class Emitter {
    constructor(){ this.events = Object.create(null); }
    on(name, fn){ (this.events[name] ||= []).push(fn); return this; }
    off(name, fn){ this.events[name] = (this.events[name]||[]).filter(x=>x!==fn); return this; }
    emit(name, value){ for(const fn of [...(this.events[name]||[])]) { try{fn(value);}catch(e){console.error(e);} } }
  }

  class RelayConnection extends Emitter {
    constructor(peer, peerId, connId, metadata, role){
      super(); this.peer = peerId; this.connectionId = connId; this.metadata = metadata || {}; this.open = false;
      this.peerOwner = peer; this.role = role; this._pending = []; this._closedByUser = false;
    }
    send(data){
      if(this._closedByUser) return;
      if(this.open && this.peerOwner._send({type:'data', connId:this.connectionId, data})) return;
      this._pending.push(data);
      if(this._pending.length > 100) this._pending.shift();
    }
    _opened(){ if(this.open) return; this.open=true; this.emit('open'); for(const d of this._pending.splice(0)) this.peerOwner._send({type:'data',connId:this.connectionId,data:d}); }
    _data(data){ this.emit('data',data); }
    close(){ this._closedByUser=true; this.peerOwner._send({type:'close',connId:this.connectionId}); this._closed(); }
    _closed(){ if(!this.open && this._closedByUser) return; this.open=false; this.emit('close'); }
  }

  class RelayPeer extends Emitter {
    constructor(id, options={}){
      super(); this.id = id || sessionStorage.getItem('cq-relay-host-id') || randomId('room');
      this.options=options; this.destroyed=false; this.disconnected=false; this.socket=null; this.connections=new Map(); this.role=new URLSearchParams(location.search).has('room') ? 'client' : 'host'; this._everRegistered=false;
      if(this.role==='host') sessionStorage.setItem('cq-relay-host-id',this.id);
      this._retry=0; this._intentionalClose=false; this._connectSocket();
    }
    _connectSocket(){
      if(this.destroyed || this._intentionalClose) return;
      let ws;
      try { ws=new WebSocket(WS_URL()); } catch(e){ this.emit('error',{type:'network',message:e.message}); this._scheduleReconnect(); return; }
      this.socket=ws;
      ws.addEventListener('open',()=>{
        this._retry=0; this.disconnected=false;
        if(this.role==='host') this._send({type:'host-register',roomId:this.id});
        else this._send({type:'client-register',clientId:this.id});
      });
      ws.addEventListener('message',(ev)=>{
        let m; try{m=JSON.parse(ev.data);}catch{return;}
        if(m.type==='registered') { if(!this._everRegistered){this._everRegistered=true;this.emit('open',this.id);} else { this.emit('connected'); if(this.role==='client'){for(const c of this.connections.values()){if(c.role==='client') this._send({type:'join',roomId:c.peer,connId:c.connectionId,metadata:c.metadata||{},clientId:this.id});}} } return; }
        if(m.type==='incoming' && this.role==='host'){
          let c=this.connections.get(m.connId);
          if(!c){ c=new RelayConnection(this,m.clientId,m.connId,m.metadata,'host'); this.connections.set(m.connId,c); this.emit('connection',c); setTimeout(()=>c._opened(),0); }
          else { c.peer=m.clientId; c.metadata=m.metadata||{}; setTimeout(()=>c._opened(),0); }
          return;
        }
        const c=m.connId ? this.connections.get(m.connId) : null;
        if(m.type==='conn-open' && c){ c._opened(); return; }
        if(m.type==='data' && c){ c._data(m.data); return; }
        if(m.type==='conn-close' && c){ c._closed(); return; }
        if(m.type==='error') this.emit('error',{type:m.code||'server-error',message:m.message});
      });
      ws.addEventListener('close',()=>{
        if(this.destroyed || this._intentionalClose) return;
        this.disconnected=true; this.emit('disconnected');
        for(const c of this.connections.values()) { c.open=false; }
        this._scheduleReconnect();
      });
      ws.addEventListener('error',()=>{ this.emit('error',{type:'network'}); });
    }
    _scheduleReconnect(){
      if(this.destroyed || this._retryTimer) return;
      const delay=Math.min(1000*Math.pow(1.7,this._retry++),8000);
      this._retryTimer=setTimeout(()=>{this._retryTimer=null;this._connectSocket();},delay);
    }
    _send(payload){ if(this.socket && this.socket.readyState===OPEN){ try{this.socket.send(JSON.stringify(payload));return true;}catch(e){} } return false; }
    connect(roomId, options={}){
      const connId=sessionStorage.getItem(`cq-relay-conn-${roomId}`)||randomId('conn');
      sessionStorage.setItem(`cq-relay-conn-${roomId}`,connId);
      const c=new RelayConnection(this,roomId,connId,options.metadata,'client'); c.roomId=roomId; this.connections.set(connId,c);
      const join=()=>this._send({type:'join',roomId,connId,metadata:options.metadata||{},clientId:this.id});
      if(this.socket && this.socket.readyState===OPEN) join();
      else this.on('connected',join);
      return c;
    }
    reconnect(){ if(this.destroyed) return; try{this.socket?.close();}catch{} this._scheduleReconnect(); }
    destroy(){ this.destroyed=true; this._intentionalClose=true; clearTimeout(this._retryTimer); for(const c of this.connections.values()) c.close(); try{this.socket?.close();}catch{} this.emit('close'); }
  }
  window.Peer=RelayPeer;
})();
