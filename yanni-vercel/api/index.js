// Vercel Serverless Function - substitui o Cloudflare Worker
// Todas as rotas passam por aqui

const FIREBASE_PROJECT = "yanni-sushi";
const FIREBASE_API_KEY = "AIzaSyD-Qm_-JIMb5NSdow7RDAcd6PGZLDX0org";

// HTML em base64 (mesmo do worker original)
const { HTML_B64 } = require('./html_data');

function getHTML() {
  return Buffer.from(HTML_B64, 'base64').toString('utf-8');
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { pathname } = new URL(req.url, `https://${req.headers.host}`);

  // === ROTA PRINCIPAL — HTML ===
  if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(getHTML());
  }

  // === WEBHOOK InfinitePay ===
  // ⚠️ NUNCA MODIFICAR ESTA ROTA
  if (req.method === 'POST' && pathname === '/webhook') {
    try {
      const body = req.body;
      const status = body.status || body.payment_status || '';
      const orderId = body.order_id || body.id || body.reference || '';
      const valor = (body.amount || body.paid_amount || 0) / 100;
      if (['approved','paid','APPROVED','PAID'].includes(status)) {
        const pedidoId = await buscarPedidoPorRef(orderId, FIREBASE_PROJECT, FIREBASE_API_KEY);
        if (pedidoId) {
          await atualizarPedido(pedidoId, {
            status:'pago',statusPagamento:'aprovado',
            pagoEm:new Date().toISOString(),
            valorPago:valor,infinitePayOrderId:orderId
          }, FIREBASE_PROJECT, FIREBASE_API_KEY);
          return res.status(200).json({ok:true, pedidoId});
        }
      }
      return res.status(200).json({ok:true});
    } catch(e) {
      return res.status(500).json({erro:e.message});
    }
  }

  // === SUKI PAINEL (IA do painel admin) ===
  if (req.method === 'POST' && pathname === '/suki-painel') {
    try {
      const pergunta = req.body.pergunta || '';
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':'Bearer ' + process.env.GROQ_API_KEY
        },
        body:JSON.stringify({
          model:'llama-3.3-70b-versatile',
          messages:[
            {role:'system',content:'Você é Suki, assistente do Yanni Sushi de Alegrete-PI. Responda em português, máximo 3 linhas.'},
            {role:'user',content:pergunta}
          ],
          max_tokens:400
        })
      });
      const d = await r.json();
      const resposta = d.choices&&d.choices[0] ? d.choices[0].message.content : 'Suki não conseguiu conectar.';
      return res.status(200).json({resposta});
    } catch(e) {
      return res.status(200).json({resposta:'Suki não conseguiu conectar.'});
    }
  }

  // === SUKI UPSELL ===
  if (req.method === 'POST' && pathname === '/suki') {
    try {
      const p = 'Carrinho: '+(req.body.carrinho||'')+'. Escolha UM produto: '+(req.body.opcoes||'')+' Responda so o ID.';
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':'Bearer ' + process.env.GROQ_API_KEY
        },
        body:JSON.stringify({
          model:'llama-3.3-70b-versatile',
          messages:[{role:'user',content:p}],
          max_tokens:20
        })
      });
      const d = await r.json();
      const id = d.choices&&d.choices[0] ? d.choices[0].message.content.trim() : '';
      return res.status(200).json({id});
    } catch(e) {
      return res.status(200).json({id:''});
    }
  }

  // === STATUS DO PEDIDO ===
  if (req.method === 'GET' && pathname === '/status') {
    const pedidoId = new URL(req.url, `https://${req.headers.host}`).searchParams.get('pedido');
    if (!pedidoId) return res.status(400).json({erro:'pedido obrigatorio'});
    try {
      const dados = await buscarPedido(pedidoId, FIREBASE_PROJECT, FIREBASE_API_KEY);
      if (!dados) return res.status(200).json({status:'nao_encontrado'});
      return res.status(200).json({status:dados.status});
    } catch(e) {
      return res.status(500).json({erro:e.message});
    }
  }

  return res.status(404).send('Not found');
};

// ======= FUNÇÕES FIREBASE =======

async function buscarPedidoPorRef(orderId, project, apiKey) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:runQuery?key=${apiKey}`,
    {method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({structuredQuery:{from:[{collectionId:'pedidos'}],where:{fieldFilter:{field:{fieldPath:'infinitePayOrderId'},op:'EQUAL',value:{stringValue:orderId}}},limit:1}})}
  );
  const data = await res.json();
  if (data?.[0]?.document) return data[0].document.name.split('/').pop();
  return null;
}

async function buscarPedido(pedidoId, project, apiKey) {
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/pedidos/${pedidoId}?key=${apiKey}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.fields) return null;
  const obj = {};
  for (const [k,v] of Object.entries(data.fields)) obj[k] = v.stringValue??v.integerValue??v.doubleValue??v.booleanValue??null;
  return obj;
}

async function atualizarPedido(pedidoId, campos, project, apiKey) {
  const fbUrl = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/pedidos/${pedidoId}?key=${apiKey}`;
  const resGet = await fetch(fbUrl);
  const docAtual = await resGet.json();
  const fields = docAtual.fields || {};
  for (const [k,v] of Object.entries(campos)) {
    if (typeof v==='string') fields[k]={stringValue:v};
    else if (typeof v==='number') fields[k]={doubleValue:v};
    else if (typeof v==='boolean') fields[k]={booleanValue:v};
  }
  const res = await fetch(fbUrl, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields})});
  return res.ok;
}
