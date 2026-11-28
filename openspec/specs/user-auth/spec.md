# user-auth Specification

## Purpose

用户注册、登录、登出与会话维持的行为契约：凭据校验、密码安全存储、JWT 双 token 会话的签发、旋转与吊销，以及受保护资源的访问控制。

## Requirements

### Requirement: 用户注册

系统 SHALL 提供基于 email 与密码的账户注册。email 在系统内 MUST 唯一；密码 MUST NOT 以明文或可逆形式存储。

#### Scenario: 注册成功

- **WHEN** 用户提交格式合法且未被占用的 email，以及不小于 8 字符的密码
- **THEN** 系统创建账户并签发会话，用户直接进入受保护主界面

#### Scenario: email 已被占用

- **WHEN** 用户提交已被注册的 email
- **THEN** 系统返回「邮箱已存在」冲突错误，不创建新账户

#### Scenario: 输入校验失败

- **WHEN** 用户提交格式非法的 email，或长度不足 8 字符的密码
- **THEN** 系统返回明确的字段级校验错误，不创建账户

### Requirement: 用户登录

系统 SHALL 校验 email 与密码并建立会话。登录失败的错误信息 MUST NOT 区分「邮箱不存在」与「密码错误」。

#### Scenario: 登录成功

- **WHEN** 用户提交正确的 email 与密码
- **THEN** 系统签发会话 Cookie 并进入受保护主界面

#### Scenario: 凭据错误

- **WHEN** 用户提交错误的密码或不存在的 email
- **THEN** 系统返回统一的认证失败错误（401），不泄露具体原因

### Requirement: JWT 双 token 会话

会话 SHALL 由短时效 access token（约 15 分钟）与长时效 refresh token（约 7 天）构成。两者 MUST 通过 httpOnly Cookie 传输（页面脚本不可读取），且 refresh token MUST 一次性使用。

#### Scenario: access token 有效时访问受保护资源

- **WHEN** 已登录用户携带有效 access token 访问受保护页面或 API
- **THEN** 系统放行请求

#### Scenario: access token 过期后自动续期

- **WHEN** access token 已过期但 refresh token 有效
- **THEN** 系统签发新的 access token 与新的 refresh token（旧 refresh 立即作废），请求无感续期

#### Scenario: 双 token 均失效

- **WHEN** access token 与 refresh token 均已过期或不存在
- **THEN** 页面请求被重定向至登录页；API 请求返回 401

### Requirement: refresh 重放防护

系统 MUST 检测 refresh token 的重放。检测到已作废的 refresh token 被再次使用时，SHALL 撤销该用户的全部活跃会话。

#### Scenario: 重放触发全端下线

- **WHEN** 旧 refresh token（已被旋转替换）被再次提交
- **THEN** 系统撤销该用户所有会话，所有已登录端后续请求均返回 401

### Requirement: 用户登出

系统 SHALL 提供登出能力：服务端使该会话的 refresh token 失效并清除认证 Cookie。

#### Scenario: 登出后无法访问受保护资源

- **WHEN** 用户执行登出后携带旧 Cookie 访问受保护资源
- **THEN** 系统返回 401 / 重定向至登录页

### Requirement: 受保护资源访问控制

未认证的页面访问 SHALL 被重定向至登录页；未认证的 API 访问 SHALL 返回 401。

#### Scenario: 未登录访问主页

- **WHEN** 未认证用户访问主界面
- **THEN** 系统重定向至登录页

#### Scenario: 未认证调用受保护 API

- **WHEN** 未认证请求携带无效或缺失凭证调用受保护 API
- **THEN** 系统返回 401 与统一错误结构
