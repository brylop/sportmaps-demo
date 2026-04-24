<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Carrusel SportMaps Responsivo</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;900&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #0A0A0A;
            --primary: #F5A623;
            --secondary: #2E7D32;
            --text-main: #FFFFFF;
            --text-sub: #A0A0A0;
            --card-bg: #1A1A1A;
        }

        body {
            margin: 0;
            padding: 20px 0;
            background-color: #222;
            display: flex;
            flex-direction: column;
            gap: 40px;
            font-family: 'Poppins', sans-serif;
            overflow-x: hidden;
        }

        /* Contenedor responsivo que mantiene la proporción cuadrada */
        .slide-wrapper {
            width: 100%;
            max-width: 1080px;
            aspect-ratio: 1 / 1;
            position: relative;
            margin: 0 auto;
        }

        /* La slide siempre es 1080x1080 internamente */
        .slide {
            width: 1080px;
            height: 1080px;
            background-color: var(--bg);
            /* Degradados sutiles en las esquinas */
            background-image: 
                radial-gradient(circle at top left, rgba(46, 125, 50, 0.15) 0%, transparent 45%),
                radial-gradient(circle at top right, rgba(46, 125, 50, 0.12) 0%, transparent 40%),
                radial-gradient(circle at bottom right, rgba(245, 166, 35, 0.15) 0%, transparent 45%),
                radial-gradient(circle at bottom left, rgba(245, 166, 35, 0.12) 0%, transparent 40%);
            position: absolute;
            top: 0;
            left: 0;
            transform-origin: top left;
            box-sizing: border-box;
            padding: 48px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }

        /* Textura Grain */
        .slide::before {
            content: "";
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
            opacity: 0.03;
            pointer-events: none;
            z-index: 10;
        }

        .glow-orange { text-shadow: 0 0 40px rgba(245, 166, 35, 0.4); }

        h1, h2, h3, p { margin: 0; }
        .text-white { color: var(--text-main); }
        .text-orange { color: var(--primary); }
        .text-green { color: var(--secondary); }
        .text-gray { color: var(--text-sub); }
        .text-black { color: #000000; }
        
        .uppercase { text-transform: uppercase; }
        .center { text-align: center; }
        .w-full { width: 100%; }
        
        .fw-regular { font-weight: 400; }
        .fw-semibold { font-weight: 600; }
        .fw-bold { font-weight: 700; }
        .fw-black { font-weight: 900; }

        .sep-horizontal { height: 1px; background-color: var(--primary); }
        .sep-vertical { width: 1px; background-color: #2A2A2A; }

        .tag-orange { background-color: var(--primary); border-radius: 8px; padding: 6px 14px; display: inline-block; font-size: 11px; }
        .card { background-color: var(--card-bg); border-radius: 16px; position: relative; z-index: 2; }

        .footer { position: absolute; bottom: 48px; left: 48px; right: 48px; display: flex; align-items: center; justify-content: space-between; z-index: 5; }
        .footer-logo-wrap { display: flex; align-items: center; gap: 12px; }
        .img-logo { border-radius: 8px; object-fit: cover; }
        .progress { color: var(--text-sub); font-size: 14px; letter-spacing: 4px; }
        .progress .active { color: var(--primary); }

        /* S1 */
        .s1-content { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 2; }
        .s1-top { font-size: 13px; letter-spacing: 4px; }
        .s1-sep-1 { width: 80px; margin: 16px 0; }
        .s1-title-1 { font-size: 42px; line-height: 1.3; }
        .s1-title-2 { font-size: 52px; line-height: 1.3; }
        .s1-bottom { margin-top: auto; margin-bottom: 60px; font-size: 16px; z-index: 2;}
        .s1-sep-footer { position: absolute; bottom: 100px; left: 48px; right: 48px; width: calc(100% - 96px); height: 1px; background: #2A2A2A; z-index: 2;}

        /* S2 */
        .s2-content { flex: 1; display: flex; flex-direction: column; justify-content: center; z-index: 2; }
        .s2-title { font-size: 32px; line-height: 1.2; margin-top: 16px; }
        .s2-subtitle { font-size: 16px; margin-top: 8px; }
        .s2-sep { width: 60px; margin: 24px 0; }
        .s2-card { border-left: 4px solid var(--primary); padding: 28px; display: flex; gap: 24px; margin-bottom: 24px; }
        .s2-col { flex: 1; display: flex; flex-direction: column; gap: 16px; }
        .s2-list { display: flex; flex-direction: column; gap: 12px; font-size: 14px; }

        /* S3 */
        .s3-content { flex: 1; display: flex; flex-direction: column; justify-content: center; z-index: 2; }
        .s3-cards-wrap { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
        .s3-card { padding: 20px 24px; border-radius: 12px; display: flex; align-items: flex-start; gap: 16px; }
        .s3-card-green { border-left: 4px solid var(--secondary); }
        .s3-card-orange { border-left: 4px solid var(--primary); }
        .s3-icon { font-size: 20px; line-height: 1; }

        /* S4 */
        .s4-content { flex: 1; display: flex; flex-direction: column; justify-content: center; z-index: 2; }
        .s4-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
        .s4-card { padding: 24px; border-radius: 16px; }
        .s4-card-green { border-top: 3px solid var(--secondary); }
        .s4-card-orange { border-top: 3px solid var(--primary); }
        .s4-card-icon { font-size: 28px; margin: 16px 0; }

        /* S5 */
        .s5-content { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 2; }
        .s5-btn { background: var(--primary); border-radius: 50px; padding: 18px 52px; font-size: 18px; display: inline-block; text-decoration: none; box-shadow: 0 10px 30px rgba(245, 166, 35, 0.2); }
        .s5-footer-wrap { position: absolute; bottom: 48px; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 12px; z-index: 5; }
    </style>
</head>
<body>

    <div class="slide-wrapper">
        <div class="slide">
            <div class="s1-content w-full">
                <p class="s1-top text-orange uppercase fw-regular center">LO QUE NADIE TE ESTÁ CONTANDO</p>
                <div class="sep-horizontal s1-sep-1"></div>
                <h1 class="s1-title-1 text-white fw-black center">Hay mas de 50 escuelas en Colombia</h1>
                <h1 class="s1-title-2 text-orange fw-black center glow-orange">que crecen diferente.</h1>
                <h1 class="s1-title-1 text-white fw-black center">¿Sabes qué tienen en común?</h1>
            </div>
            <div class="s1-bottom w-full center text-gray fw-regular">Desliza y descubre su secreto →</div>
            <div class="s1-sep-footer"></div>
            <div class="footer" style="justify-content: center; position: relative; bottom: 0; left: 0; right: 0; margin-top: auto; padding-top: 24px;">
                <div class="footer-logo-wrap" style="position: absolute; left: 48px;">
                    <img src="LOGO FINAL.jpg" alt="SportMaps" class="img-logo" style="height: 36px;">
                    <span class="text-gray fw-regular" style="font-size: 11px;">sportmaps.co</span>
                </div>
                <div class="progress" style="position: absolute; right: 48px;"><span class="active">●</span> ○ ○ ○ ○</div>
            </div>
        </div>
    </div>

    <div class="slide-wrapper">
        <div class="slide">
            <div class="s2-content w-full">
                <div><span class="tag-orange fw-bold uppercase text-black">SECRETO #1</span></div>
                <h2 class="s2-title text-white fw-bold">Dejaron de perseguir<br>pagos por WhatsApp.</h2>
                <p class="s2-subtitle text-gray fw-regular">Para siempre.</p>
                <div class="sep-horizontal s2-sep"></div>
                <div class="card s2-card">
                    <div class="s2-col">
                        <span class="text-gray fw-semibold uppercase" style="font-size: 12px;">ANTES</span>
                        <div class="s2-list text-gray fw-regular">
                            <span><span style="color:#E53935">✗</span> WhatsApp a las 11pm</span>
                            <span><span style="color:#E53935">✗</span> Pagos olvidados</span>
                            <span><span style="color:#E53935">✗</span> Excusas infinitas</span>
                            <span><span style="color:#E53935">✗</span> Cartera morosa acumulada</span>
                        </div>
                    </div>
                    <div class="sep-vertical"></div>
                    <div class="s2-col">
                        <span class="text-green fw-semibold uppercase" style="font-size: 12px;">CON SPORTMAPS</span>
                        <div class="s2-list text-white fw-regular">
                            <span><span class="text-green">✓</span> Cobros automáticos</span>
                            <span><span class="text-green">✓</span> Recordatorios solos</span>
                            <span><span class="text-green">✓</span> Pagos en la app</span>
                            <span><span class="text-green">✓</span> Cero persecución</span>
                        </div>
                    </div>
                </div>
                <p class="text-gray fw-regular center" style="font-size: 15px; position: relative; z-index: 2;">Tú entrenas. SportMaps cobra.</p>
            </div>
            <div class="footer">
                <img src="LOGO FINAL.jpg" alt="SportMaps" class="img-logo" style="height: 32px;">
                <div class="progress">○ <span class="active">●</span> ○ ○ ○</div>
            </div>
        </div>
    </div>

    <div class="slide-wrapper">
        <div class="slide">
            <div class="s3-content w-full">
                <div><span class="tag-orange fw-bold uppercase text-black">SECRETO #2</span></div>
                <h2 class="s2-title text-white fw-bold">Saben exactamente<br>quién llegó hoy.</h2>
                <p class="s2-subtitle text-gray fw-regular">Sin listas. Sin papel. Sin excusas.</p>
                <div class="sep-horizontal s2-sep"></div>
                <div class="s3-cards-wrap">
                    <div class="card s3-card s3-card-green">
                        <div class="s3-icon">📱</div>
                        <div>
                            <h3 class="text-white fw-semibold" style="font-size: 16px; margin-bottom: 4px;">Asistencia desde el celular</h3>
                            <p class="text-gray fw-regular" style="font-size: 13px;">Un toque y el registro queda guardado en tiempo real.</p>
                        </div>
                    </div>
                    <div class="card s3-card s3-card-orange">
                        <div class="s3-icon">🔔</div>
                        <div>
                            <h3 class="text-white fw-semibold" style="font-size: 16px; margin-bottom: 4px;">Alertas automáticas de ausencias</h3>
                            <p class="text-gray fw-regular" style="font-size: 13px;">SportMaps avisa cuando un atleta lleva 3 faltas seguidas.</p>
                        </div>
                    </div>
                    <div class="card s3-card s3-card-orange">
                        <div class="s3-icon">📊</div>
                        <div>
                            <h3 class="text-white fw-semibold" style="font-size: 16px; margin-bottom: 4px;">Historial completo de cada atleta</h3>
                            <p class="text-gray fw-regular" style="font-size: 13px;">Semanas, meses, años — todo registrado sin esfuerzo.</p>
                        </div>
                    </div>
                </div>
                <p class="text-gray fw-regular center" style="font-size: 15px; position: relative; z-index: 2;">Lo que antes tomaba 1 hora, ahora toma 10 segundos.</p>
            </div>
            <div class="footer">
                <img src="LOGO FINAL.jpg" alt="SportMaps" class="img-logo" style="height: 32px;">
                <div class="progress">○ ○ <span class="active">●</span> ○ ○</div>
            </div>
        </div>
    </div>

    <div class="slide-wrapper">
        <div class="slide">
            <div class="s4-content w-full">
                <div><span class="tag-orange fw-bold uppercase text-black">SECRETOS #3 Y #4</span></div>
                <h2 class="text-white fw-bold" style="font-size: 30px; line-height: 1.2; margin-top: 16px;">Sus atletas crecen.<br>Sus decisiones tienen datos.</h2>
                <div class="sep-horizontal s2-sep"></div>
                <div class="s4-grid">
                    <div class="card s4-card s4-card-green">
                        <span class="text-green fw-bold uppercase" style="font-size: 11px;">SECRETO #3</span>
                        <div class="s4-card-icon text-orange">👤</div>
                        <h3 class="text-white fw-semibold" style="font-size: 17px; margin-bottom: 8px;">Atletas con perfil digital</h3>
                        <p class="text-gray fw-regular" style="font-size: 13px; line-height: 1.5;">Cada atleta tiene su historial, pagos y progreso en un solo lugar. Tú lo ves todo.</p>
                    </div>
                    <div class="card s4-card s4-card-orange">
                        <span class="text-orange fw-bold uppercase" style="font-size: 11px;">SECRETO #4</span>
                        <div class="s4-card-icon text-green">🧠</div>
                        <h3 class="text-white fw-semibold" style="font-size: 17px; margin-bottom: 8px;">Decisiones con datos reales</h3>
                        <p class="text-gray fw-regular" style="font-size: 13px; line-height: 1.5;">Nada de intuición. Reportes automáticos que te dicen qué está funcionando y qué no.</p>
                    </div>
                </div>
                <p class="text-gray fw-regular center" style="font-size: 15px; position: relative; z-index: 2;">Esto no es tecnología del futuro. Ya está pasando en Colombia.</p>
            </div>
            <div class="footer">
                <img src="LOGO FINAL.jpg" alt="SportMaps" class="img-logo" style="height: 32px;">
                <div class="progress">○ ○ ○ <span class="active">●</span> ○</div>
            </div>
        </div>
    </div>

    <div class="slide-wrapper">
        <div class="slide">
            <div class="s5-content w-full">
                <p class="text-orange uppercase fw-regular center" style="font-size: 13px; letter-spacing: 4px;">Y AHORA QUE YA LO SABES...</p>
                <div class="sep-horizontal" style="width: 80px; margin: 20px 0;"></div>
                <h1 class="text-white fw-black center" style="font-size: 48px; line-height: 1.2;">¿Tu escuela sigue<br>gestionando como<br>hace 10 años?</h1>
                <p class="text-gray fw-regular center" style="font-size: 18px; margin-top: 16px;">Las ~50 escuelas colombianas que cambiaron<br>no esperaron al momento perfecto.</p>
                <div style="height: 32px;"></div>
                <a href="#" class="s5-btn text-black fw-bold">Empieza gratis → sportmaps.co</a>
                <div style="height: 24px;"></div>
                <p class="text-gray fw-regular center" style="font-size: 13px;">Sin tarjeta de crédito. Sin contratos. Sin complicaciones.</p>
                <div class="s1-sep-footer" style="bottom: 140px;"></div>
            </div>
            <div class="s5-footer-wrap" style="left: 0;">
                <img src="LOGO FINAL.jpg" alt="SportMaps" class="img-logo" style="height: 48px; border-radius: 12px;">
                <span class="text-gray fw-regular" style="font-size: 12px;">Ecosistema Deportivo Integral · Colombia 🇨🇴</span>
            </div>
            <div class="progress" style="position: absolute; bottom: 48px; right: 48px; z-index: 5;">○ ○ ○ ○ <span class="active">●</span></div>
        </div>
    </div>

    <script>
        // Este script calcula el ancho del contenedor y ajusta la escala de la slide (que siempre es 1080px)
        function scaleSlides() {
            const wrappers = document.querySelectorAll('.slide-wrapper');
            wrappers.forEach(wrapper => {
                const width = wrapper.clientWidth;
                // Escala basándonos en los 1080px originales
                const scale = width / 1080;
                const slide = wrapper.querySelector('.slide');
                slide.style.transform = `scale(${scale})`;
            });
        }

        // Ejecutar al cargar la página y cada vez que se cambie el tamaño de la ventana
        window.addEventListener('load', scaleSlides);
        window.addEventListener('resize', scaleSlides);
    </script>
</body>
</html>