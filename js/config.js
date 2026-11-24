/* TERDEF wargaming platform – futásidejű beállítások (publikus, csak olvasó kulcs) */
window.LWP_CONFIG = {
  version: '0.1.2',
  date: '2026-11-24',
  app: 'TERDEF wargaming platform',
  supabaseUrl: 'https://xaklmjaexyhcbztklyqf.supabase.co',
  supabaseKey: 'sb_publishable_KdbxMCfCt7vh3olVAoVpvQ_tJ4z8jgw',
  bucket: 'lwp-media',
  mediaPrefix: 'tdw/',
  maxUploadMB: 50,
  // gyakorlatvezetői belépési kód SHA-256 lenyomata (kliensoldali ellenőrzés – gyakorlati eszköz, nem éles védelem)
  leadPinSha256: '4e30dc70afcdb1c82967262eba1c1105735f7266de2cc46f843c587095e941fc',
  // JEMM generátor (n8n chat webhook)
  jemmWebhook: 'https://castor81.app.n8n.cloud/webhook/8775acc0-450e-4604-84f5-64b65baed040/chat'
};
