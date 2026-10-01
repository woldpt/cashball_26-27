## Adjunto: retrato em medalhão substitui o cartoon (2026-10-01)
- Pedido: «boneco mais realista, cara do Jorge Jesus». Cinco rondas de retrato vector desenhado à mão (3/4, perfil, editorial com traço a tinta) não convenceram; a via que funciona é **retrato de verdade** num medalhão.
- Decisão do utilizador: fornecer ele próprio a imagem. Fonte: caricatura assinada de terceiros (`i.industriacriativa.pt/23842/15f18d3d950b74.jpg`) — direitos e crédito são responsabilidade do utilizador; fica registado aqui para rastreio.
- Asset: `client/public/coaches/assistant.webp` (256×256, 18 KB), gerado com `magick <fonte> -crop 400x400+130+55 +repage -resize 256x256 -unsharp 0x0.6+0.5+0.02 -quality 84` (recorte dentro do verde para não apanhar a moldura branca).
- Componente: só `AssistantMascot` em `components/shared/AssistantCoach.jsx` — medalhão 108 px (disco verde da casa `#1f8f4f→#0a3d1e` + anel a tinta + filete claro + retrato circular); `mood` "sad" dessatura/escurece o retrato por filtro CSS. Balão, hook e contrato do harness intactos.
- Testado e rejeitado: duotone verde/branco (a pele fica verde, mata a cara — mantidas as cores originais, que já estão na paleta do jogo); estilo manga `PlayerAvatar` (Tsubasa: menos realista que o pedido); emblema de silhueta (gráfico mas nada realista).
- Checks: `lint` limpo no ficheiro (3 erros pré-existentes noutros) · `check:types` OK · `test:mobile assistant-resp-test` PASS 5/5 + screenshots 360/430 vistos (sem overflow já a 320px).

