# Microservizio: `mar-dashboard`

**Web Operator Dashboard & Real-Time Telemetry Interface (Next.js 14)**  
*Parte dell'architettura a microservizi M.A.R. (Multi-legged Autonomous Robot)*

---

## Ruolo nell'Architettura a Microservizi

`mar-dashboard` è l'interfaccia utente grafica dedicata all'operatore per la supervisione, il monitoraggio della telemetria e la teleoperazione remota del quadrupede:
1. **Visualizzazione Streaming Video 3D**:
   - Riceve e visualizza il feed video MJPEG stereo ad alta risoluzione erogato da `mar-vision-service` (`http://<IP_RPI>:8080/stream/left` o `/stream/depth`).
2. **Radar Perimetrale 2D (LiDAR)**:
   - Disegna la scansione polare a 360° ricevuta via WebSocket da `mar-gateway` (originata da `mar-lidar-service`).
3. **Telemetria Hardware in Tempo Reale**:
   - Indicatori grafici per tensione della batteria (BMS), assorbimento di corrente, assetto roll/pitch (orizzonte artificiale) e stato delle zampe provenienti da `mar-firmware` via `mar-serial-bridge`.
4. **Teleoperazione Manuale & Emergency Stop**:
   - Joystick virtuale di controllo per override manuale.
   - Selettore andature (*Trot, Crawl, Stand, Sit*).
   - Pulsante rosso di **Arresto d'Emergenza (E-Stop)** prioritario collegato al topic di sicurezza `mar/safety/estop`.

---

## Stack Tecnologico
- **Framework**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS, Lucide React Icons
- **State Management**: Zustand
- **Database & Auth**: Prisma ORM, JWT, bcryptjs

---

## Integrazione di Rete
- **WebSocket Gateway**: `ws://mar-gateway:8765` (oppure `ws://localhost:8765`)
- **Video Feed**: `http://mar-vision-service:8080/stream/left`

---

## Setup e Avvio Rapido

### Con Docker Compose (Consigliato)
```bash
docker compose up -d mar-dashboard
```

### In Locale per Sviluppo
```bash
npm install
npx prisma generate
npm run dev
```
La dashboard sarà accessibile all'indirizzo `http://localhost:3000`.
