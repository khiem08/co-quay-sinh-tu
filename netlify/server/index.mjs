import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

const httpServer = createServer((req,res)=>{
  if(req.url==='/healthz'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,service:'co-quay-relay'}));return;}
  res.writeHead(404);res.end('Not found');
});
const wss = new WebSocketServer({noServer:true, maxPayload:256*1024});
const rooms = new Map(); // roomId -> { host, expiresAt, clients:Set }
const links = new Map(); // connId -> { roomId, host, client, expiresAt }
const send=(ws,obj)=>{if(ws && ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(obj));};
const cleanupRoom=(roomId)=>{
  const room=rooms.get(roomId); if(!room) return;
  for(const id of room.clients){const l=links.get(id); if(l){send(l.client,{type:'conn-close',connId:id});links.delete(id);}}
  rooms.delete(roomId);
};
httpServer.on('upgrade',(req,socket,head)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname!=='/ws'){socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
});
wss.on('connection',ws=>{
  ws.role=null; ws.roomId=null; ws.clientId=null; ws.isAlive=true;
  ws.on('pong',()=>ws.isAlive=true);
  ws.on('message',raw=>{
    let m; try{m=JSON.parse(raw.toString());}catch{return;}
    if(!m || typeof m.type!=='string') return;
    if(m.type==='host-register'){
      const roomId=String(m.roomId||'').slice(0,100); if(!roomId) return;
      let room=rooms.get(roomId); if(!room){room={host:null,expiresAt:0,clients:new Set()};rooms.set(roomId,room);}
      if(room.host && room.host!==ws && room.host.readyState===WebSocket.OPEN){send(ws,{type:'error',code:'unavailable-id',message:'Room ID already active'});return;}
      room.host=ws;room.expiresAt=0;ws.role='host';ws.roomId=roomId;
      send(ws,{type:'registered',roomId});
      for(const id of room.clients){const l=links.get(id);if(l){l.host=ws;send(ws,{type:'incoming',connId:id,clientId:l.clientId,metadata:l.metadata});if(l.client)send(l.client,{type:'conn-open',connId:id});}}
      return;
    }
    if(m.type==='client-register'){ws.role='client';ws.clientId=String(m.clientId||'').slice(0,100);send(ws,{type:'registered',clientId:ws.clientId});return;}
    if(m.type==='join'){
      const roomId=String(m.roomId||'').slice(0,100), connId=String(m.connId||'').slice(0,120), room=rooms.get(roomId);
      if(!room || !room.host || room.host.readyState!==WebSocket.OPEN){send(ws,{type:'error',code:'peer-unavailable',message:'Room is not online'});return;}
      let link=links.get(connId);
      if(link && link.roomId!==roomId){send(ws,{type:'error',code:'invalid-id'});return;}
      const isNew=!link;
      if(!link){link={roomId,host:room.host,client:null,clientId:ws.clientId||m.clientId,metadata:m.metadata||{},expiresAt:0};links.set(connId,link);room.clients.add(connId);}
      const hostChanged=link.host!==room.host;
      link.client=ws;link.clientId=ws.clientId||m.clientId||link.clientId;link.host=room.host;link.metadata=m.metadata||link.metadata;link.expiresAt=0;
      ws.role='client';ws.roomId=roomId;ws.connId=connId;
      if(isNew || hostChanged) send(room.host,{type:'incoming',connId,clientId:link.clientId,metadata:link.metadata});
      send(ws,{type:'conn-open',connId}); return;
    }
    if(m.type==='data'){
      const link=links.get(String(m.connId)); if(!link) return;
      if(ws===link.client) send(link.host,{type:'data',connId:m.connId,data:m.data});
      else if(ws===link.host) send(link.client,{type:'data',connId:m.connId,data:m.data});
      return;
    }
    if(m.type==='close'){
      const id=String(m.connId), link=links.get(id); if(!link) return;
      if(ws===link.host || ws===link.client){send(link.host,{type:'conn-close',connId:id});send(link.client,{type:'conn-close',connId:id});links.delete(id);rooms.get(link.roomId)?.clients.delete(id);}
    }
    if(m.type==='heartbeat') send(ws,{type:'heartbeat-ack'});
  });
  ws.on('close',()=>{
    if(ws.role==='host' && ws.roomId){const room=rooms.get(ws.roomId);if(room?.host===ws){room.host=null;room.expiresAt=Date.now()+120000;}}
    if(ws.role==='client' && ws.connId){const link=links.get(ws.connId);if(link?.client===ws){link.client=null;link.expiresAt=Date.now()+45000;}}
  });
});
setInterval(()=>{
  const now=Date.now();
  for(const [id,l] of links){if(l.expiresAt && l.expiresAt<now){send(l.host,{type:'conn-close',connId:id});links.delete(id);rooms.get(l.roomId)?.clients.delete(id);}}
  for(const [id,r] of rooms){if(r.expiresAt && r.expiresAt<now) cleanupRoom(id);}
},5000).unref();
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue;}ws.isAlive=false;try{ws.ping();}catch{}}},25000);heartbeat.unref();
httpServer.listen(process.env.PORT || 8888);
export default httpServer;
