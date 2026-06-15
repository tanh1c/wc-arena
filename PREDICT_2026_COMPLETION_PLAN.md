# Predict 2026 — UI/UX + Product Completion Plan

> Mục tiêu: hoàn thiện web dự đoán tỉ số World Cup 2026 theo phong cách **minimal brutalism / World Cup 2026 theme**, có prediction loop rõ ràng, leaderboard hấp dẫn, badge/rank/streak, private league và prize-pool/community-prize đủ minh bạch để triển khai thực tế.

---

## 0. Tóm tắt hiện trạng FE sau khi đọc source

Source hiện tại đã có các màn chính sau:

| Page hiện có | File | Trạng thái |
|---|---|---|
| Landing | `src/Landing.tsx` | Đã có UI landing, hero, stats, upcoming matches, leaderboard preview |
| Make Picks | `src/Picks.tsx` | Đã có UI nhập tỉ số, slip, top players, scoring rules |
| Fixtures / Matches | `src/Fixtures.tsx` | Đã có UI lịch đấu, trạng thái match, live/completed/sidebar |
| Leaderboard | `src/Leaderboard.tsx` | Đã có UI ranking, top 3, stats, movers, prize breakdown |
| Rules | `src/Rules.tsx` | Đã có scoring/rules/prize explanation |
| Prize Pool | `src/PrizePool.tsx` | Đã có prize distribution và payout info UI |
| Login | `src/Login.tsx` | Đã có UI sign in |
| Register | `src/Register.tsx` | Đã có UI create account |
| Onboarding | `src/Onboarding.tsx` | Đã có UI onboarding cơ bản |

Những điểm cần refactor trước khi code thêm nhiều page:

1. **Navigation đang dùng local `page` state trong `App.tsx`**, chưa dùng React Router. Khi số trang tăng, cách này sẽ khó scale.
2. **Layout header/frame/settings bị copy-paste ở nhiều file**. Nên tách `AppShell`, `TopNav`, `MacFrame`, `SettingsMenu`, `WalletButton`, `HeroBanner`.
3. **Dữ liệu đang hardcoded trong component** như matches, leaderboard, slip, prize. Cần tách sang `src/data/mock.ts` hoặc store/API layer.
4. **Chưa có domain model rõ ràng**: `Match`, `Prediction`, `User`, `Badge`, `League`, `PrizePool`, `ScoreBreakdown`.
5. **Chưa có scoring engine thật**. UI đang hiển thị điểm nhưng chưa có logic tính điểm, lock pick, cập nhật leaderboard.
6. **Chưa có trang profile, badges, private leagues, prediction history đầy đủ, match detail, result breakdown, activity/share card, settings/admin**.
7. **Prize pool có yếu tố nhạy cảm**. Nếu prize do user đóng góp rồi người thắng nhận, cần tránh thiết kế giống betting/gambling. Nên định vị là free-to-play contest với sponsor/donation-backed prize pool.

---

## 1. Product positioning nên giữ từ đầu

Không nên định vị là web “cá cược tỉ số”. Nên định vị là:

> **A free-to-play World Cup prediction arena where fans predict scores, earn points, unlock badges, climb leagues, and compete for sponsor/community-backed prizes.**

Tiếng Việt:

> **Đấu trường dự đoán World Cup: miễn phí tham gia, thắng bằng kỹ năng dự đoán, leo rank, mở badge, đấu với bạn bè và nhận thưởng từ sponsor/community prize pool.**

Lý do:

- Tránh cảm giác betting/gambling.
- Dễ viral hơn vì user không cần nạp tiền mới chơi.
- Dễ làm private league/friends league.
- Dễ gắn sponsor/donation thay vì user stake tiền.

---

## 2. Core game loop cần hoàn thiện

Loop chính của web phải chạy mượt trước khi thêm nhiều trang đẹp:

```txt
User đăng ký
→ chọn country/fan club/avatar
→ xem fixtures
→ dự đoán tỉ số + confidence/risk pick
→ pick bị lock trước kickoff
→ trận có kết quả
→ scoring engine tính điểm
→ leaderboard cập nhật
→ streak/badge/rank cập nhật
→ user nhận notification/share card
→ user quay lại dự đoán trận tiếp theo
```

Nếu loop này chưa chạy thật thì badge, prize pool, private league chỉ là UI trang trí.

---

## 3. Route map đề xuất

### 3.1. Nhóm public/auth

| Route | Page | Mục đích | Ưu tiên |
|---|---|---|---|
| `/` | Landing | Giới thiệu game, CTA | Đã có |
| `/login` | Login | Đăng nhập | Đã có |
| `/register` | Register | Tạo tài khoản | Đã có |
| `/onboarding` | Onboarding | Chọn username/avatar/country/fan club | Đã có nhưng cần nâng cấp |

### 3.2. Nhóm gameplay chính

| Route | Page | Mục đích | Ưu tiên |
|---|---|---|---|
| `/matches` | Fixtures / Matches | Xem lịch đấu, trạng thái trận | Đã có |
| `/matches/:matchId` | Match Detail | Chi tiết trận, pick, odds-like strength, activity | Cao |
| `/picks` | Make Picks | Nhập dự đoán hàng loạt | Đã có |
| `/my-predictions` | Prediction History | Lịch sử pick, điểm, breakdown | Cao |
| `/predictions/:predictionId` | Prediction Detail | Chi tiết một pick + scoring breakdown | Cao |
| `/leaderboard` | Leaderboard | Xếp hạng tổng | Đã có |
| `/profile/:username` | User Profile | Hồ sơ, rank, badge, history | Cao |

### 3.3. Nhóm retention/social

| Route | Page | Mục đích | Ưu tiên |
|---|---|---|---|
| `/badges` | Badges/Achievements | Badge đã mở/chưa mở/progress | Cao |
| `/leagues` | Private Leagues | Danh sách league bạn tham gia | Cao |
| `/leagues/create` | Create League | Tạo phòng/private league | Cao |
| `/leagues/:leagueId` | League Detail | Leaderboard riêng, fixtures, invite | Cao |
| `/activity` | Activity Feed | Thông báo điểm, badge, rank, deadline | Trung bình |
| `/share/:resultId` | Share Result Card | Trang/preview card chia sẻ thành tích | Trung bình |

### 3.4. Nhóm money/prize/admin

| Route | Page | Mục đích | Ưu tiên |
|---|---|---|---|
| `/prize-pool` | Prize Pool | Phân phối giải, sponsor/donation pool | Đã có |
| `/rewards` | Rewards | Prize eligibility, pending/paid rewards | Trung bình |
| `/wallet` | Wallet | Donation/reward history nếu cần | Thấp/Muộn |
| `/settings` | Settings | Account, notification, privacy | Trung bình |
| `/admin` | Admin Dashboard | Import results, recalc score, audit | Cao nếu có prize thật |
| `/admin/audit` | Audit Log | Chống gian lận, pick history, admin action | Cao nếu có prize thật |

---

## 4. Các page cần code thêm, theo thứ tự nên làm

## Phase 1 — Dọn nền tảng FE trước khi thêm page

### 4.1. Cài React Router

Hiện tại `App.tsx` dùng:

```tsx
const [page, setPage] = useState('landing');
```

Nên chuyển sang:

```txt
react-router-dom
```

Route gợi ý:

```tsx
<Routes>
  <Route path="/" element={<Landing />} />
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />
  <Route path="/onboarding" element={<Onboarding />} />
  <Route path="/matches" element={<Fixtures />} />
  <Route path="/matches/:matchId" element={<MatchDetail />} />
  <Route path="/picks" element={<Picks />} />
  <Route path="/my-predictions" element={<MyPredictions />} />
  <Route path="/predictions/:predictionId" element={<PredictionDetail />} />
  <Route path="/leaderboard" element={<Leaderboard />} />
  <Route path="/profile/:username" element={<Profile />} />
  <Route path="/badges" element={<Badges />} />
  <Route path="/leagues" element={<Leagues />} />
  <Route path="/leagues/create" element={<CreateLeague />} />
  <Route path="/leagues/:leagueId" element={<LeagueDetail />} />
  <Route path="/rules" element={<Rules />} />
  <Route path="/prize-pool" element={<PrizePool />} />
  <Route path="/activity" element={<Activity />} />
  <Route path="/settings" element={<Settings />} />
</Routes>
```

### 4.2. Tách layout dùng chung

Tạo thư mục:

```txt
src/components/layout/
  AppShell.tsx
  MacFrame.tsx
  TopNav.tsx
  WalletButton.tsx
  SettingsMenu.tsx
  HeroBanner.tsx
  RainbowGraphic.tsx
  BottomSteps.tsx
```

Lợi ích:

- Không copy-paste header ở 10 page.
- Dark mode/theme dễ sửa một chỗ.
- Navigation active state chuẩn hơn.
- Code page gọn, tập trung vào nội dung.

### 4.3. Tách UI primitives brutalism

Tạo:

```txt
src/components/ui/
  BrutalCard.tsx
  BrutalButton.tsx
  StatCard.tsx
  SectionHeader.tsx
  Tabs.tsx
  StatusPill.tsx
  ScoreInput.tsx
  EmptyState.tsx
  Countdown.tsx
  FlagBadge.tsx
```

Ví dụ props:

```tsx
type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  tone: 'lime' | 'blue' | 'green' | 'orange' | 'red' | 'neutral';
};
```

### 4.4. Tách mock data

Tạo:

```txt
src/data/mockMatches.ts
src/data/mockUsers.ts
src/data/mockPredictions.ts
src/data/mockBadges.ts
src/data/mockLeagues.ts
src/data/mockPrizePool.ts
```

Sau này thay mock bằng API sẽ dễ hơn.

---

## Phase 2 — Hoàn thiện gameplay core

## 5. Trang `/matches/:matchId` — Match Detail

### Mục tiêu

Cho user xem chi tiết một trận và dự đoán ngay tại đó.

### UI layout

Nên gồm:

1. Header: `BRAZIL vs SPAIN`, kickoff, stadium, group/stage.
2. Status card: `OPEN`, `LOCKED SOON`, `LIVE`, `FULL TIME`.
3. Prediction panel:
   - Score input
   - Confidence slider
   - Risk Pick toggle
   - Save prediction button
4. Team strength panel:
   - FIFA rank / Elo-like strength / recent form mock
   - Head-to-head nếu có
5. Community trend:
   - `% users pick Brazil win / draw / Spain win`
   - Most common exact score
6. Your pick status:
   - Submitted at
   - Edited count
   - Lock deadline
7. Result/scoring panel sau trận:
   - Actual result
   - Score breakdown
   - Points earned

### Trạng thái cần xử lý

```txt
OPEN: user được nhập/sửa pick
LOCKED_SOON: warning, vẫn sửa được
LOCKED: không sửa được
LIVE: chỉ xem pick, không sửa
FINISHED_PENDING_SCORE: đợi tính điểm
SCORED: hiện điểm + breakdown
POSTPONED: pick giữ nguyên hoặc unlock theo rule
CANCELLED: void pick
```

---

## 6. Trang `/my-predictions` — My Predictions / History

### Mục tiêu

User xem lại toàn bộ dự đoán, kết quả, điểm và streak.

### UI sections

1. Stat cards:
   - Total picks
   - Exact scores
   - Accuracy
   - Current streak
2. Filter tabs:
   - All
   - Open
   - Locked
   - Pending
   - Scored
   - Exact
   - Correct
   - Missed
3. Prediction table/card list:
   - Date/time
   - Match
   - Your prediction
   - Actual result
   - Status
   - Points
   - Action: edit/view breakdown
4. Right sidebar:
   - Prediction summary
   - Points breakdown
   - Best streak
   - Next deadline
5. Empty states:
   - No picks yet
   - No exact scores yet
   - No missed predictions yet

### Fields cần có

```ts
type Prediction = {
  id: string;
  matchId: string;
  userId: string;
  homeScore: number;
  awayScore: number;
  confidence?: number;
  isRiskPick?: boolean;
  status: 'draft' | 'submitted' | 'locked' | 'scored' | 'void';
  submittedAt: string;
  updatedAt?: string;
  lockedAt?: string;
  scoreBreakdown?: ScoreBreakdown;
};
```

---

## 7. Modal/page `PredictionDetail` — Scoring Breakdown

### Mục tiêu

Minh bạch tuyệt đối cách tính điểm.

### Nội dung

```txt
Your pick: Brazil 2-1 Spain
Actual: Brazil 2-1 Spain

Exact score: +3
Correct outcome: +1
Goal difference bonus: +1
Confidence bonus: +2
Risk multiplier: x2
Streak bonus: +2
Total: +16 pts
```

### Vì sao quan trọng

Nếu có prize pool, user sẽ nghi ngờ ngay khi điểm không rõ. Breakdown là thứ tạo trust.

---

## 8. Scoring engine đề xuất

Nên viết riêng:

```txt
src/domain/scoring.ts
```

### Rule base MVP

```ts
type ScoreBreakdown = {
  exactScore: number;
  correctOutcome: number;
  goalDifference: number;
  confidenceBonus: number;
  riskMultiplier: number;
  streakBonus: number;
  underdogBonus: number;
  knockoutBonus: number;
  total: number;
};
```

### Công thức dễ hiểu

| Điều kiện | Điểm |
|---|---:|
| Exact score | +3 |
| Correct outcome | +1 |
| Correct goal difference | +1 |
| Confidence bonus | 0 đến +2 |
| Risk pick exact score | x2 hoặc x3 |
| Streak 3+ | +2 |
| Streak 5+ | +5 |
| Underdog correct | +2 đến +6 |
| Knockout exact | +1 |

### Cẩn thận

Đừng làm điểm quá phức tạp ngay từ đầu. User cần hiểu nhanh tại sao mình được điểm.

---

## Phase 3 — Identity, badges, rank và retention

## 9. Trang `/profile/:username` — User Profile

### Mục tiêu

Profile là nơi user khoe rank, badge, streak và fan identity.

### UI sections

1. Profile hero:
   - Avatar + avatar ring
   - Username
   - Country/fan club chip
   - Current rank badge
   - Verified badge nếu có
2. Main stats:
   - Rank
   - Points
   - Accuracy
   - Exact scores
   - Current streak
   - Best streak
3. Badge showcase:
   - 3–6 badge nổi bật
   - View all badges
4. Prediction form:
   - Last 5 matches
   - Pick/result/points
5. Rank progress:
   - Rank movement chart mock
   - Today/weekly/global position
6. Share profile CTA:
   - Copy profile link
   - Generate share card

### Asset SVG nên dùng

- Avatar ring
- Rank shield
- Hot streak
- Exact score
- Underdog
- Comeback
- Country/fan club chip

---

## 10. Trang `/badges` — Achievements

### Mục tiêu

Biến prediction game thành collection game.

### Badge categories

| Category | Examples |
|---|---|
| Prediction skill | Exact Score Merchant, Draw Specialist |
| Streak | Hot Streak, Fire Run, Untouchable |
| Risk/strategy | Risk Taker, Underdog Whisperer, Giant Killer |
| Leaderboard | Top 100, Top 10, Weekly Champion |
| Social | League Creator, Invite Captain |
| Event | Group Stage Prophet, Knockout Prophet |

### Badge model

```ts
type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'skill' | 'streak' | 'risk' | 'rank' | 'social' | 'event';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt?: string;
  progressCurrent: number;
  progressTarget: number;
};
```

### UI states

- Earned badge: full color.
- Locked badge: grayscale/low opacity.
- In progress: progress bar.
- Featured badge: bigger card.

---

## 11. Activity / Notifications

### Route

```txt
/activity
```

### Mục tiêu

Kéo user quay lại đúng lúc.

### Event examples

```txt
Your Brazil vs Spain pick scored +8 pts.
You unlocked Hot Streak.
You moved up 15 ranks.
France vs Argentina locks in 30 minutes.
GoalGuru passed you in Friends League.
Prize pool increased by $200.
```

### Notification types

```ts
type ActivityEvent = {
  id: string;
  type: 'pick_scored' | 'rank_up' | 'badge_unlocked' | 'deadline' | 'league_invite' | 'prize_update';
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  href?: string;
};
```

---

## Phase 4 — Private leagues, social growth, share card

## 12. Trang `/leagues` — Private Leagues

### Vì sao nên làm sớm

Private league là growth loop mạnh hơn global leaderboard. Người dùng thường thích thắng bạn bè hơn thắng người lạ.

### UI sections

1. My leagues list:
   - League name
   - Members
   - Your rank
   - Prize/Reward
   - Next deadline
2. Join by code:
   - Input invite code
3. Create league CTA
4. Featured public leagues nếu muốn

---

## 13. Trang `/leagues/create` — Create League

### Fields

```txt
League name
Visibility: private/public
Invite code
Max members
Scoring rules: global/default/custom
Prize type: no prize / sponsor / symbolic / manual
Start stage: group / knockout / full tournament
```

### Cẩn thận

Không nên cho user tự tạo “cash pool đóng tiền ăn tiền” trong MVP. Nên để:

```txt
No prize
Symbolic prize
Sponsor/community prize
Manual offline prize
```

---

## 14. Trang `/leagues/:leagueId` — League Detail

### Sections

1. League header:
   - Name, members, creator, invite code
2. League leaderboard:
   - Rank, player, points, accuracy, streak
3. League fixtures:
   - Upcoming matches
4. Recent activity:
   - Who scored points, who unlocked badge
5. Prize/rules:
   - League-specific rules if any
6. Invite friends:
   - Copy link/share card

---

## 15. Share Result Card

### Mục tiêu

Tạo viral loop sau mỗi trận.

### UI flow

Sau khi trận được scored:

```txt
Modal: You earned +8 pts
Rank #124 → #72
Badge unlocked: Hot Streak
[Download Share Card] [Copy Link]
```

### Card content

```txt
Brazil 2-1 Spain
I predicted it exactly.
+8 PTS
Rank #124 → #72
Hot Streak x4
Predict 2026
```

### Implementation frontend

- MVP: tạo HTML card + screenshot bằng `html-to-image`.
- Sau này: backend render bằng `satori`/`sharp` nếu deploy cần ổn định.

---

## Phase 5 — Prize/reward/payment-safe layer

## 16. Prize pool design nên dùng

### Nên làm

```txt
Free entry
Sponsor-funded prize pool
Community donation pool không bắt buộc
Prize eligibility rõ ràng
Public rules
Public score calculation
Admin audit log
```

### Không nên làm sớm

```txt
User nạp tiền để tham gia
Winner ăn tiền từ tiền người thua
Platform lấy fee trực tiếp từ entry fee
Random lottery prize từ tiền user
```

Các mô hình sau dễ bị hiểu là gambling/lottery. Nếu làm thật cần tư vấn pháp lý theo quốc gia.

---

## 17. Trang `/rewards`

### Mục tiêu

Cho user biết mình có đủ điều kiện nhận thưởng chưa.

### UI sections

1. Eligibility:
   - Account verified?
   - Minimum predictions?
   - Rules accepted?
   - Suspicious activity? no/yes
2. Reward status:
   - Pending
   - Approved
   - Paid
3. Prize history:
   - Daily/weekly/overall rewards
4. Payout info:
   - Email/PayPal/bank/manual

### Cẩn thận UX

Không nên đặt “wallet balance” quá nổi nếu chưa có payment thật. Nó khiến sản phẩm trông giống betting hơn.

---

## Phase 6 — Admin + anti-cheat

## 18. Admin Dashboard

Nếu có prize, admin là bắt buộc.

### Admin modules

```txt
Matches
- Import fixtures
- Update kickoff/result/status
- Lock/unlock manually

Predictions
- Search picks
- View edit history
- Force recalc score

Leaderboard
- Recalculate rankings
- Freeze leaderboard after tournament

Users
- Suspicious users
- Multi-account checks
- Ban/disqualify

Prize Pool
- Sponsor/donation entries
- Prize distribution
- Payout status

Audit Log
- Every admin action
- Every pick update
- Every score recalculation
```

---

## 19. Anti-cheat requirements

Tối thiểu:

1. Server time, không tin client time.
2. Pick lock dựa trên kickoff time server.
3. Không cho edit sau lock.
4. Mọi edit phải lưu history.
5. Không xóa pick cũ, chỉ tạo revision mới.
6. Scoring engine versioned.
7. Admin actions phải audit.
8. Rate limit login/register/pick submit.
9. Detect multi-account cơ bản:
   - email domain pattern
   - IP/device/session fingerprint ở mức hợp pháp
   - suspicious same picks in bulk
10. Public scoring rules trước giải.

---

## 20. Data model đề xuất

## 20.1. User

```ts
type User = {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  countryCode?: string;
  fanClubTeamId?: string;
  role: 'user' | 'admin';
  points: number;
  rank?: number;
  accuracy?: number;
  exactScores: number;
  currentStreak: number;
  bestStreak: number;
  createdAt: string;
};
```

## 20.2. Match

```ts
type Match = {
  id: string;
  stage: 'group' | 'round16' | 'quarter' | 'semi' | 'final';
  group?: string;
  matchday?: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: string;
  lockAt: string;
  stadium: string;
  city: string;
  status: 'scheduled' | 'open' | 'locked' | 'live' | 'finished' | 'postponed' | 'cancelled';
  homeScore?: number;
  awayScore?: number;
  resultUpdatedAt?: string;
};
```

## 20.3. Prediction

```ts
type Prediction = {
  id: string;
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  confidence: number; // 0-100
  isRiskPick: boolean;
  createdAt: string;
  updatedAt: string;
  lockedAt?: string;
  status: 'submitted' | 'locked' | 'scored' | 'void';
  revision: number;
};
```

## 20.4. ScoreBreakdown

```ts
type ScoreBreakdown = {
  predictionId: string;
  exactScore: number;
  correctOutcome: number;
  goalDifference: number;
  confidenceBonus: number;
  riskMultiplier: number;
  streakBonus: number;
  underdogBonus: number;
  knockoutBonus: number;
  total: number;
  scoringVersion: string;
  calculatedAt: string;
};
```

## 20.5. League

```ts
type League = {
  id: string;
  name: string;
  slug: string;
  creatorId: string;
  visibility: 'private' | 'public';
  inviteCode: string;
  memberCount: number;
  scoringMode: 'global' | 'custom';
  prizeMode: 'none' | 'symbolic' | 'sponsor' | 'manual';
  createdAt: string;
};
```

## 20.6. Badge

```ts
type Badge = {
  id: string;
  name: string;
  description: string;
  category: 'skill' | 'streak' | 'risk' | 'rank' | 'social' | 'event';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  iconPath: string;
};
```

---

## 21. Frontend folder structure đề xuất

```txt
src/
  app/
    App.tsx
    routes.tsx
    providers.tsx

  components/
    layout/
      AppShell.tsx
      MacFrame.tsx
      TopNav.tsx
      WalletButton.tsx
      SettingsMenu.tsx
      HeroBanner.tsx
      BottomSteps.tsx
    ui/
      BrutalCard.tsx
      BrutalButton.tsx
      StatCard.tsx
      Tabs.tsx
      StatusPill.tsx
      ScoreInput.tsx
      Countdown.tsx
      FlagBadge.tsx
      EmptyState.tsx
    match/
      MatchCard.tsx
      MatchTable.tsx
      MatchStatusBadge.tsx
      PredictionEditor.tsx
    leaderboard/
      LeaderboardTable.tsx
      TopThreePodium.tsx
      RankMovement.tsx
    badges/
      BadgeCard.tsx
      BadgeGrid.tsx
      BadgeProgress.tsx

  pages/
    Landing.tsx
    Login.tsx
    Register.tsx
    Onboarding.tsx
    Fixtures.tsx
    MatchDetail.tsx
    Picks.tsx
    MyPredictions.tsx
    PredictionDetail.tsx
    Leaderboard.tsx
    Profile.tsx
    Badges.tsx
    Leagues.tsx
    CreateLeague.tsx
    LeagueDetail.tsx
    Rules.tsx
    PrizePool.tsx
    Rewards.tsx
    Activity.tsx
    Settings.tsx
    Admin.tsx

  domain/
    scoring.ts
    ranking.ts
    badges.ts
    predictionLock.ts

  data/
    mockMatches.ts
    mockUsers.ts
    mockPredictions.ts
    mockBadges.ts
    mockLeagues.ts
    mockPrizePool.ts

  types/
    domain.ts

  assets/
    badges/
    ranks/
    icons/
```

---

## 22. Backend/API plan tối thiểu

Nếu FE đang làm trước, vẫn nên thiết kế API sớm để tránh mock data sai cấu trúc.

### API endpoints

```txt
Auth
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/me
PATCH /api/me/onboarding

Matches
GET /api/matches
GET /api/matches/:id
POST /api/admin/matches/import
PATCH /api/admin/matches/:id/result

Predictions
GET /api/predictions/me
POST /api/predictions
PATCH /api/predictions/:id
GET /api/predictions/:id/breakdown

Leaderboard
GET /api/leaderboard/global
GET /api/leaderboard/weekly
GET /api/leaderboard/friends
GET /api/leaderboard/leagues/:leagueId

Badges
GET /api/badges
GET /api/users/:username/badges

Leagues
GET /api/leagues/me
POST /api/leagues
POST /api/leagues/join
GET /api/leagues/:id
GET /api/leagues/:id/leaderboard

Prize/Rewards
GET /api/prize-pool
GET /api/rewards/me

Activity
GET /api/activity
PATCH /api/activity/:id/read
```

---

## 23. Database tables gợi ý

```txt
users
teams
matches
predictions
prediction_revisions
score_breakdowns
leaderboard_snapshots
badges
user_badges
leagues
league_members
activity_events
prize_pools
prize_distributions
donations_or_sponsor_contributions
admin_audit_logs
```

Đặc biệt nên có `prediction_revisions` để chống tranh cãi:

```txt
prediction_id
old_home_score
old_away_score
new_home_score
new_away_score
edited_at
client_info
server_time
```

---

## 24. Asset plan cần bổ sung

Bạn đã có streak badge và rank badge. Nên gom asset theo hierarchy:

### 24.1. Small status icons — 24/32px

```txt
open.svg
locked-soon.svg
locked.svg
live.svg
full-time.svg
pending.svg
scored.svg
postponed.svg
correct.svg
wrong.svg
exact-score.svg
```

### 24.2. Medium badges — 64/96px

```txt
hot-streak.svg
exact-score-merchant.svg
draw-specialist.svg
underdog-whisperer.svg
risk-taker.svg
comeback-king.svg
giant-killer.svg
knockout-prophet.svg
```

### 24.3. Large emblems — 128/256px

```txt
rank-bronze.svg
rank-silver.svg
rank-gold.svg
rank-platinum.svg
rank-diamond.svg
rank-master.svg
rank-grandmaster.svg
weekly-champion.svg
global-top-10.svg
world-cup-prophet.svg
```

### 24.4. Identity assets

```txt
default-avatar.svg
avatar-ring-basic.svg
avatar-ring-premium.svg
verified-badge.svg
country-fan-chip.svg
username-plate.svg
```

### 24.5. Share card decorations

```txt
perfect-pick-stamp.svg
rank-up-stamp.svg
hot-streak-stamp.svg
called-it-stamp.svg
share-frame-corner.svg
```

---

## 25. UI/UX rules để giữ style đồng nhất

### 25.1. Layout style

- Giữ brutal frame: border dày, title uppercase, card rõ block.
- Mỗi page nên có:
  - Top nav
  - Hero/title banner
  - Stat cards
  - Main content grid
  - Sidebar nếu cần
  - Bottom steps/guide nếu phù hợp

### 25.2. Màu

Accent nên dùng theo vai trò:

| Token | Vai trò |
|---|---|
| Lime/yellow | Prize, rank, highlight, exact score |
| Blue | CTA chính, active tab, wallet |
| Green | Open/correct/success |
| Orange | Warning, deadline, streak/risk |
| Red | Wrong/locked/live danger |

Không dùng quá nhiều màu trong cùng một card. Mỗi card chỉ nên có 1 accent chính.

### 25.3. Dark mode

Dark mode không được invert light mode. Dùng:

```txt
page: #05070D
card: #0E131B
elevated: #151B26
border: #263044
text: #F4F7FF
subtle: #A7B0C2
accent: blue/lime
```

### 25.4. Responsive

Hiện layout desktop rất mạnh, nhưng cần kiểm tra mobile:

- Table lớn nên chuyển thành card list.
- Sidebar nên xuống dưới.
- Header nav nên thành drawer/menu.
- Score inputs phải đủ lớn để tap.

---

## 26. Implementation backlog chi tiết

## Milestone 1 — Codebase foundation

- [ ] Cài `react-router-dom`.
- [ ] Chuyển `App.tsx` sang route-based navigation.
- [ ] Tách `AppShell`, `TopNav`, `SettingsMenu`, `WalletButton`.
- [ ] Tách `RainbowGraphic`, `HeroBanner`, `BottomSteps`.
- [ ] Tạo `types/domain.ts`.
- [ ] Tách mock data khỏi page components.
- [ ] Tạo `src/domain/scoring.ts` và unit test thủ công ban đầu.

## Milestone 2 — Core prediction

- [ ] Hoàn thiện `/matches` filter thật.
- [ ] Tạo `/matches/:matchId`.
- [ ] Picks page dùng data model chung.
- [ ] Implement prediction status: open/locked/live/scored.
- [ ] Implement countdown lock.
- [ ] Tạo scoring breakdown modal.
- [ ] Tạo `/my-predictions`.
- [ ] Tạo `/predictions/:predictionId`.

## Milestone 3 — Ranking/profile/badges

- [ ] Leaderboard dùng user model chung.
- [ ] Tạo `/profile/:username`.
- [ ] Tạo `/badges`.
- [ ] Implement badge progress mock.
- [ ] Implement streak calculation.
- [ ] Implement rank movement mock.

## Milestone 4 — Social/private league

- [ ] Tạo `/leagues`.
- [ ] Tạo `/leagues/create`.
- [ ] Tạo `/leagues/:leagueId`.
- [ ] Invite code UI.
- [ ] League leaderboard.
- [ ] League activity.

## Milestone 5 — Reward/prize trust

- [ ] Nâng cấp Prize Pool page với sponsor/community framing.
- [ ] Tạo `/rewards`.
- [ ] Prize eligibility checklist.
- [ ] Payout status UI.
- [ ] Public rules link rõ hơn.

## Milestone 6 — Admin/anti-cheat

- [ ] Tạo `/admin` UI mock.
- [ ] Import result tool UI.
- [ ] Recalculate scoring UI.
- [ ] Suspicious users table.
- [ ] Audit log table.

---

## 27. Những quyết định nên chốt trước khi code backend

1. Game có hoàn toàn free-to-play không?
2. Prize pool do sponsor/donation hay user entry fee?
3. Có cần KYC/identity verification cho winner không?
4. Scoring exact/outcome/streak/risk tính thế nào?
5. Pick lock trước kickoff bao lâu?
6. Trận postponed/cancelled xử lý ra sao?
7. Có cho sửa pick không? Nếu có, lưu revision thế nào?
8. Private league có custom scoring không?
9. Badge unlock có ảnh hưởng điểm không hay chỉ cosmetic?
10. Leaderboard reset daily/weekly/stage như thế nào?

---

## 28. MVP gọn nhất nên build trước

Nếu muốn ra bản dùng thử nhanh, chỉ cần:

```txt
1. Auth mock/login/register/onboarding
2. Matches page thật với fixture data
3. Picks page submit được dự đoán
4. Prediction lock theo kickoff
5. Scoring engine local/mock backend
6. My Predictions history
7. Leaderboard global
8. Profile
9. Badges cơ bản
10. Private league basic
```

Tạm hoãn:

```txt
Wallet thật
Donation thật
Payout thật
Admin phức tạp
Share card auto-generate
Custom league scoring
```

---

## 29. Rủi ro lớn nhất cần tránh

### 29.1. Rủi ro sản phẩm

Nếu chỉ là “nhập tỉ số rồi xem leaderboard”, web sẽ nhanh chán. Cần có:

```txt
streak
badges
risk pick
private league
share card
rank movement
```

### 29.2. Rủi ro pháp lý/prize

Nếu user đóng tiền vào pool rồi winner lấy tiền, sản phẩm dễ bị nhìn như betting. Nên đi theo hướng:

```txt
free entry
sponsor prize
community donation không bắt buộc
skill leaderboard
public rules
```

### 29.3. Rủi ro kỹ thuật

Nếu không tách domain model/scoring sớm, sau này đổi rule sẽ vỡ toàn bộ UI.

### 29.4. Rủi ro trust

Nếu không có scoring breakdown/audit/revision history, user sẽ nghi ngờ gian lận khi có prize.

---

## 30. Checklist “definition of done” cho bản hoàn thiện

Một bản tương đối hoàn chỉnh nên đạt:

- [ ] User có thể đăng ký/onboarding.
- [ ] User xem được toàn bộ matches.
- [ ] User dự đoán được trước khi lock.
- [ ] Pick bị khóa theo server time.
- [ ] Kết quả trận cập nhật được.
- [ ] Điểm được tính bằng scoring engine riêng.
- [ ] User xem được scoring breakdown.
- [ ] Leaderboard cập nhật theo điểm.
- [ ] Profile hiển thị rank/badge/streak/history.
- [ ] Badges unlock theo điều kiện.
- [ ] Private league tạo/join được.
- [ ] Activity feed báo deadline/points/badges.
- [ ] Prize pool/rules rõ ràng.
- [ ] Admin có thể import result/recalculate score.
- [ ] Có audit log cho pick/admin/scoring.
- [ ] Mobile layout dùng được.
- [ ] Dark mode/light mode đều đọc rõ.

---

## 31. Hướng code tiếp theo nên làm ngay

Thứ tự tôi đề xuất cho bước kế tiếp:

1. **Refactor `App.tsx` sang React Router**.
2. **Tách shared layout** để không copy header/frame/settings nữa.
3. **Tạo domain types + mock data layer**.
4. **Viết scoring engine `src/domain/scoring.ts`**.
5. **Code `/my-predictions` đúng layout đã thiết kế**.
6. **Code `/matches/:matchId` + scoring breakdown modal**.
7. **Code `/profile/:username` và `/badges`**.
8. **Code `/leagues` + `/leagues/:leagueId`**.

Lý do: `My Predictions`, `Match Detail`, `Profile`, `Badges`, `Leagues` là những phần biến project từ “UI demo” thành “game thật có retention”.

---

## 32. Gợi ý tên component cho các page còn thiếu

```txt
src/pages/MyPredictions.tsx
src/pages/MatchDetail.tsx
src/pages/PredictionDetail.tsx
src/pages/Profile.tsx
src/pages/Badges.tsx
src/pages/Leagues.tsx
src/pages/CreateLeague.tsx
src/pages/LeagueDetail.tsx
src/pages/Activity.tsx
src/pages/Rewards.tsx
src/pages/Settings.tsx
src/pages/AdminDashboard.tsx
```

Component nhỏ:

```txt
PredictionHistoryTable
PredictionHistoryCard
ScoreBreakdownPanel
BadgeShowcase
BadgeUnlockModal
ProfileHero
RankProgressCard
LeagueCard
InviteCodeBox
ActivityItem
ShareResultModal
```

---

## 33. Kết luận

Source hiện tại đã có nền UI khá tốt: style nhất quán, theme World Cup 2026 rõ, các page public chính đã dựng được. Nhưng để thành sản phẩm thật, việc quan trọng không phải vẽ thêm page ngay, mà là chuyển từ **static UI mock** sang **game system**:

```txt
Prediction model
→ Locking
→ Scoring
→ Ranking
→ Badges/streaks
→ Profile/social
→ Private leagues
→ Prize trust/audit
```

Nếu làm theo thứ tự trên, Predict 2026 sẽ khác các web dự đoán tỉ số bình thường ở chỗ nó có identity, rank, streak, badge, private league, share card và cơ chế prize minh bạch — tức là giống một prediction game/arena hơn là một form nhập tỉ số đơn giản.
