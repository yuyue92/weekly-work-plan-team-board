# Weekly Work Plan - Team Board

Vue 3 + Vite + Supabase 版本。支持账号登录、管理员/员工角色权限、云端数据存储。

## 目录结构

```
src/
├── App.vue                        # 路由出口
├── main.js                        # 应用入口
├── assets/main.css                # 完整样式（原版 + 新增）
├── lib/supabase.js                # Supabase 客户端单例
├── constants/index.js             # 静态常量（状态枚举、时间槽等）
├── utils/
│   ├── date.js                    # 周历计算
│   ├── helpers.js                 # 通用工具
│   └── model.js                   # 数据模型转换（DB行 ↔ 前端对象）
├── composables/
│   ├── useAuth.js                 # 认证状态（登录/注册/登出/profile）
│   └── useBoardStore.js           # 看板业务逻辑（Supabase 读写）
├── router/index.js                # 路由（含登录态守卫）
├── pages/
│   ├── LoginPage.vue              # 登录 / 注册页
│   └── BoardPage.vue              # 看板主页
└── components/
    ├── AppToolbar.vue
    ├── BoardTable.vue
    ├── ItemCard.vue
    ├── ItemModal.vue
    ├── TaskRow.vue
    └── ToastMessage.vue

supabase/
└── schema.sql                     # 建表 + RLS 策略（在 Supabase SQL Editor 执行）
```

## 第一步：Supabase 项目配置

### 1. 创建 Supabase 项目
前往 https://supabase.com 创建新项目。

### 2. 执行数据库脚本
在 Supabase 控制台 → **SQL Editor** → 新建查询，粘贴 `supabase/schema.sql` 全部内容执行。

脚本会创建：
- `teams` 表（初始插入 Customer_Service_Process / team2 / team3）
- `profiles` 表（用户扩展信息，注册时自动触发器写入）
- `team_users` 表（用户与 team 的多对多关联）
- `work_items` 表
- `tasks` 表
- 完整 RLS 行级安全策略

### 3. 关闭邮件确认（开发阶段可选）
Supabase 控制台 → **Authentication → Providers → Email** → 关闭 "Confirm email"，方便调试注册流程。生产环境建议开启。

### 4. 获取 API 密钥
控制台 → **Project Settings → API**，复制：
- `Project URL`
- `anon public` key

## 第二步：本地开发

```bash
# 1. 复制环境变量文件
cp .env.example .env.local

# 2. 编辑 .env.local，填入你的 Supabase 信息
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# 3. 安装依赖
npm install

# 4. 启动开发服务器
npm run dev
# 访问 http://localhost:5173
```

## 第三步：初始化团队成员

注册、登录流程：
1. 打开应用，点击「注册」，填写显示名称 + `@pccw.com` 邮箱 + 密码
2. 注册成功后登录

**将用户加入 Team**（目前需要在 Supabase 后台操作）：

```sql
-- 查询用户 ID
select id, email, display_name from public.profiles;

-- 查询 team ID
select id, name from public.teams;

-- 将用户加入 team
insert into public.team_users (team_id, user_id)
values ('team-uuid-这里', 'user-uuid-这里');
```

**提升为管理员**：

```sql
update public.profiles
set role = 'admin'
where email = 'xxx@pccw.com';
```

## 第四步：部署到 Vercel

```bash
# 构建
npm run build

# 使用 Vercel CLI 部署（或在 Vercel 网页端连接 GitHub 仓库）
npx vercel --prod
```

在 Vercel 项目设置 → **Environment Variables** 中添加：
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 权限说明

| 操作 | 普通员工（staff） | 管理员（admin） |
|------|-----------------|----------------|
| 查看所有人看板 | ✅ | ✅ |
| 新增自己的 Work Item | ✅ | ✅ |
| 编辑/删除自己的 Work Item | ✅ | ✅ |
| 编辑/删除他人的 Work Item | ❌ | ✅ |
| 拖拽移动自己的卡片 | ✅ | ✅ |
| 拖拽移动他人卡片 | ❌ | ✅ |
| 清空当前周（全部） | ❌ | ✅ |

> 权限由 Supabase RLS 策略在数据库层强制执行，不依赖前端判断，无法绕过。

## 注册限制

仅允许 `@pccw.com` 结尾的邮箱注册（在 `src/constants/index.js` 的 `ALLOWED_EMAIL_DOMAIN` 修改）。
