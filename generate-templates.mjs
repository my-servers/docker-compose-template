import fs from 'node:fs';
import path from 'node:path';

const repoRoot = '/tmp/docker-compose-template';
const templatesRoot = path.join(repoRoot, 'templates');

const stringField = (key, label, description, defaultValue, input = 'text', placeholder = defaultValue, required = true) => ({
  key,
  label,
  description,
  placeholder,
  value_type: 'string',
  input,
  required,
  default_value: defaultValue,
});

const numberField = (key, label, description, defaultValue, placeholder = defaultValue, required = true) => ({
  key,
  label,
  description,
  placeholder: String(placeholder),
  value_type: 'number',
  input: 'number',
  required,
  default_value: String(defaultValue),
});

const pathField = (key, label, description, defaultValue, required = true) =>
  stringField(key, label, description, defaultValue, 'path', defaultValue, required);

const timezoneField = () => stringField('timezone', '时区', '容器运行时区', 'Asia/Shanghai');
const puidField = () => numberField('puid', 'PUID', '宿主机用户 ID，群晖/飞牛常见为 1000', 1000);
const pgidField = () => numberField('pgid', 'PGID', '宿主机用户组 ID，群晖/飞牛常见为 1000', 1000);
const containerField = (value) => stringField('container_name', '容器名称', 'Docker 容器名称', value);
const portField = (key, label, description, value) => numberField(key, label, description, value);

const portMapFields = (hostDefault, containerDefault, protocolDefault = 'tcp', hostLabel = '宿主机端口', containerLabel = '容器端口') => [
  numberField('host', hostLabel, '暴露到宿主机的端口', hostDefault),
  numberField('container', containerLabel, '容器内部监听端口', containerDefault),
  {
    key: 'protocol',
    label: '协议',
    description: '端口协议',
    value_type: 'string',
    input: 'select',
    required: true,
    default_value: protocolDefault,
    options: [
      { label: 'TCP', value: 'tcp' },
      { label: 'UDP', value: 'udp' },
    ],
  },
];

const defaultGroupItems = (fields) => [{ fields }];

const portGroup = (key, label, description, defaults) => {
  const fields = portMapFields(defaults.host, defaults.container, defaults.protocol ?? 'tcp', defaults.hostLabel, defaults.containerLabel);
  return {
    key,
    label,
    description,
    item_label: label.replace(/映射$/, ''),
    min_items: 1,
    fields,
    default_items: defaultGroupItems(fields),
  };
};

const volumeGroupFields = (sourceDefault, targetDefault, modeDefault = 'rw', sourceLabel = '宿主机目录', targetLabel = '容器目录') => [
  pathField('source', sourceLabel, '宿主机目录路径', sourceDefault),
  pathField('target', targetLabel, '容器内目录路径', targetDefault),
  {
    key: 'mode',
    label: '挂载模式',
    description: '目录挂载模式',
    value_type: 'string',
    input: 'select',
    required: true,
    default_value: modeDefault,
    options: [
      { label: '只读', value: 'ro' },
      { label: '读写', value: 'rw' },
    ],
  },
];

const volumeGroup = (key, label, description, defaults) => {
  const fields = volumeGroupFields(defaults.source, defaults.target, defaults.mode ?? 'rw', defaults.sourceLabel, defaults.targetLabel);
  return {
    key,
    label,
    description,
    item_label: label.replace(/映射$/, ''),
    min_items: 1,
    fields,
    default_items: defaultGroupItems(fields),
  };
};

const templates = [
  {
    id: 'nginx-static',
    name: 'Nginx 静态站点',
    description: '快速部署一个可挂载静态目录的 Nginx 服务',
    icon: 'network',
    args: {
      schema: [
        stringField('image_tag', '镜像标签', 'Nginx 镜像标签', 'stable'),
        containerField('nginx-static'),
      ],
      groups: [
        portGroup('ports', '端口映射', '支持添加多个端口映射', { host: 8080, container: 80 }),
        volumeGroup('volumes', '目录映射', '支持添加多个目录挂载', {
          source: './html',
          target: '/usr/share/nginx/html',
          mode: 'ro',
          sourceLabel: '宿主机目录',
          targetLabel: '容器目录',
        }),
      ],
    },
    compose: `services:
  nginx:
    image: nginx:{{image_tag}}
    container_name: {{container_name}}
    restart: unless-stopped
    ports:
{{#ports}}
      - "{{host}}:{{container}}/{{protocol}}"
{{/ports}}
    volumes:
{{#volumes}}
      - {{source}}:{{target}}:{{mode}}
{{/volumes}}
`,
  },
  {
    id: 'portainer',
    name: 'Portainer',
    description: 'Docker 图形化管理面板，适合先部署后统一管理其它容器',
    icon: 'server.rack',
    args: {
      schema: [
        containerField('portainer'),
        portField('http_port', '管理页面端口', 'Portainer Web 管理端口', 9000),
        portField('edge_port', 'Edge Agent 端口', 'Portainer Edge Agent 端口', 8000),
        pathField('data_dir', '数据目录', 'Portainer 数据目录', './data'),
      ],
      groups: [],
    },
    compose: `services:
  portainer:
    image: portainer/portainer-ce:lts
    container_name: {{container_name}}
    restart: unless-stopped
    ports:
      - "{{http_port}}:9000"
      - "{{edge_port}}:8000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - {{data_dir}}:/data
`,
  },
  {
    id: 'adguard-home',
    name: 'AdGuard Home',
    description: '全家设备可用的广告拦截与 DNS 服务，默认使用 host 网络降低配置成本',
    icon: 'shield.lefthalf.filled',
    args: {
      schema: [
        containerField('adguard-home'),
        pathField('work_dir', '工作目录', 'AdGuard Home 工作目录', './work'),
        pathField('config_dir', '配置目录', 'AdGuard Home 配置目录', './conf'),
      ],
      groups: [],
    },
    compose: `services:
  adguardhome:
    image: adguard/adguardhome:latest
    container_name: {{container_name}}
    restart: unless-stopped
    network_mode: host
    volumes:
      - {{work_dir}}:/opt/adguardhome/work
      - {{config_dir}}:/opt/adguardhome/conf
`,
  },
  {
    id: 'qbittorrent',
    name: 'qBittorrent',
    description: '常用下载器模板，默认带 WebUI 与 BT 端口',
    icon: 'arrow.down.circle',
    args: {
      schema: [
        containerField('qbittorrent'),
        timezoneField(),
        puidField(),
        pgidField(),
        portField('webui_port', 'WebUI 端口', '浏览器访问 qBittorrent 的端口', 8080),
        pathField('config_dir', '配置目录', 'qBittorrent 配置目录', './config'),
        pathField('downloads_dir', '下载目录', '下载文件保存目录', './downloads'),
      ],
      groups: [],
    },
    compose: `services:
  qbittorrent:
    image: lscr.io/linuxserver/qbittorrent:latest
    container_name: {{container_name}}
    restart: unless-stopped
    environment:
      - TZ={{timezone}}
      - PUID={{puid}}
      - PGID={{pgid}}
      - WEBUI_PORT={{webui_port}}
    ports:
      - "{{webui_port}}:{{webui_port}}"
      - "6881:6881"
      - "6881:6881/udp"
    volumes:
      - {{config_dir}}:/config
      - {{downloads_dir}}:/downloads
`,
  },
  {
    id: 'jellyfin',
    name: 'Jellyfin',
    description: '开源影音媒体库，默认提供 HTTP 访问与媒体目录挂载',
    icon: 'play.tv',
    args: {
      schema: [
        containerField('jellyfin'),
        timezoneField(),
        puidField(),
        pgidField(),
        portField('http_port', '访问端口', 'Jellyfin HTTP 访问端口', 8096),
        pathField('config_dir', '配置目录', 'Jellyfin 配置目录', './config'),
        pathField('cache_dir', '缓存目录', 'Jellyfin 缓存目录', './cache'),
        pathField('media_dir', '媒体目录', '影视资源目录', './media'),
      ],
      groups: [],
    },
    compose: `services:
  jellyfin:
    image: lscr.io/linuxserver/jellyfin:latest
    container_name: {{container_name}}
    restart: unless-stopped
    environment:
      - TZ={{timezone}}
      - PUID={{puid}}
      - PGID={{pgid}}
    ports:
      - "{{http_port}}:8096"
    volumes:
      - {{config_dir}}:/config
      - {{cache_dir}}:/cache
      - {{media_dir}}:/media
`,
  },
  {
    id: 'plex',
    name: 'Plex',
    description: 'Plex 媒体库，默认使用 host 网络，适合局域网即装即用',
    icon: 'sparkles.tv',
    args: {
      schema: [
        containerField('plex'),
        timezoneField(),
        puidField(),
        pgidField(),
        stringField('plex_claim', 'Claim Token', '首次绑定 Plex 账号时可填写，可留空', '', 'text', '', false),
        pathField('config_dir', '配置目录', 'Plex 配置目录', './config'),
        pathField('transcode_dir', '转码目录', 'Plex 转码缓存目录', './transcode'),
        pathField('media_dir', '媒体目录', '影视资源目录', './media'),
      ],
      groups: [],
    },
    compose: `services:
  plex:
    image: lscr.io/linuxserver/plex:latest
    container_name: {{container_name}}
    restart: unless-stopped
    network_mode: host
    environment:
      - TZ={{timezone}}
      - PUID={{puid}}
      - PGID={{pgid}}
      - VERSION=docker
      - PLEX_CLAIM={{plex_claim}}
    volumes:
      - {{config_dir}}:/config
      - {{transcode_dir}}:/transcode
      - {{media_dir}}:/media
`,
  },
  {
    id: 'immich',
    name: 'Immich',
    description: '照片备份与管理服务，内置 Redis 和 Postgres 依赖，适合一键起完整栈',
    icon: 'photo.on.rectangle',
    args: {
      schema: [
        containerField('immich-server'),
        timezoneField(),
        portField('http_port', '访问端口', 'Immich Web 页面端口', 2283),
        stringField('db_password', '数据库密码', 'Immich PostgreSQL 密码', 'immich'),
        pathField('uploads_dir', '照片目录', 'Immich 上传照片目录', './library'),
        pathField('db_dir', '数据库目录', 'PostgreSQL 数据目录', './postgres'),
      ],
      groups: [],
    },
    compose: `services:
  immich-server:
    image: ghcr.io/immich-app/immich-server:release
    container_name: {{container_name}}
    restart: unless-stopped
    depends_on:
      - immich-redis
      - immich-database
    environment:
      - TZ={{timezone}}
      - DB_HOSTNAME=immich-database
      - DB_USERNAME=postgres
      - DB_PASSWORD={{db_password}}
      - DB_DATABASE_NAME=immich
      - REDIS_HOSTNAME=immich-redis
      - UPLOAD_LOCATION=/usr/src/app/upload
    ports:
      - "{{http_port}}:2283"
    volumes:
      - {{uploads_dir}}:/usr/src/app/upload

  immich-redis:
    image: redis:7-alpine
    container_name: immich-redis
    restart: unless-stopped

  immich-database:
    image: ghcr.io/immich-app/postgres:14-vectorchord0.4.3-pgvectors0.2.0
    container_name: immich-database
    restart: unless-stopped
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD={{db_password}}
      - POSTGRES_DB=immich
    volumes:
      - {{db_dir}}:/var/lib/postgresql/data
`,
  },
  {
    id: 'home-assistant',
    name: 'Home Assistant',
    description: '智能家居中枢，默认 host 网络与特权模式，减少发现设备的配置成本',
    icon: 'house',
    args: {
      schema: [
        containerField('home-assistant'),
        timezoneField(),
        pathField('config_dir', '配置目录', 'Home Assistant 配置目录', './config'),
      ],
      groups: [],
    },
    compose: `services:
  home-assistant:
    image: ghcr.io/home-assistant/home-assistant:stable
    container_name: {{container_name}}
    restart: unless-stopped
    network_mode: host
    privileged: true
    environment:
      - TZ={{timezone}}
    volumes:
      - {{config_dir}}:/config
`,
  },
  {
    id: 'sonarr',
    name: 'Sonarr',
    description: '电视剧自动化管理服务，适合配合下载器一起使用',
    icon: 'tv',
    args: {
      schema: [
        containerField('sonarr'),
        timezoneField(),
        puidField(),
        pgidField(),
        portField('http_port', '访问端口', 'Sonarr Web 页面端口', 8989),
        pathField('config_dir', '配置目录', 'Sonarr 配置目录', './config'),
        pathField('tv_dir', '剧集目录', '电视剧媒体目录', './tv'),
        pathField('downloads_dir', '下载目录', '下载器共享目录', './downloads'),
      ],
      groups: [],
    },
    compose: `services:
  sonarr:
    image: lscr.io/linuxserver/sonarr:latest
    container_name: {{container_name}}
    restart: unless-stopped
    environment:
      - TZ={{timezone}}
      - PUID={{puid}}
      - PGID={{pgid}}
    ports:
      - "{{http_port}}:8989"
    volumes:
      - {{config_dir}}:/config
      - {{tv_dir}}:/tv
      - {{downloads_dir}}:/downloads
`,
  },
  {
    id: 'radarr',
    name: 'Radarr',
    description: '电影自动化管理服务，适合配合下载器一起使用',
    icon: 'film',
    args: {
      schema: [
        containerField('radarr'),
        timezoneField(),
        puidField(),
        pgidField(),
        portField('http_port', '访问端口', 'Radarr Web 页面端口', 7878),
        pathField('config_dir', '配置目录', 'Radarr 配置目录', './config'),
        pathField('movies_dir', '电影目录', '电影媒体目录', './movies'),
        pathField('downloads_dir', '下载目录', '下载器共享目录', './downloads'),
      ],
      groups: [],
    },
    compose: `services:
  radarr:
    image: lscr.io/linuxserver/radarr:latest
    container_name: {{container_name}}
    restart: unless-stopped
    environment:
      - TZ={{timezone}}
      - PUID={{puid}}
      - PGID={{pgid}}
    ports:
      - "{{http_port}}:7878"
    volumes:
      - {{config_dir}}:/config
      - {{movies_dir}}:/movies
      - {{downloads_dir}}:/downloads
`,
  },
  {
    id: 'prowlarr',
    name: 'Prowlarr',
    description: '索引器聚合管理服务，可统一给 Sonarr、Radarr 等提供索引源',
    icon: 'dot.radiowaves.left.and.right',
    args: {
      schema: [
        containerField('prowlarr'),
        timezoneField(),
        puidField(),
        pgidField(),
        portField('http_port', '访问端口', 'Prowlarr Web 页面端口', 9696),
        pathField('config_dir', '配置目录', 'Prowlarr 配置目录', './config'),
      ],
      groups: [],
    },
    compose: `services:
  prowlarr:
    image: lscr.io/linuxserver/prowlarr:latest
    container_name: {{container_name}}
    restart: unless-stopped
    environment:
      - TZ={{timezone}}
      - PUID={{puid}}
      - PGID={{pgid}}
    ports:
      - "{{http_port}}:9696"
    volumes:
      - {{config_dir}}:/config
`,
  },
  {
    id: 'emby',
    name: 'Emby',
    description: '中文 NAS 圈常见的影音媒体库方案',
    icon: 'play.rectangle',
    args: {
      schema: [
        containerField('emby'),
        timezoneField(),
        puidField(),
        pgidField(),
        portField('http_port', '访问端口', 'Emby HTTP 访问端口', 8096),
        pathField('config_dir', '配置目录', 'Emby 配置目录', './config'),
        pathField('transcode_dir', '转码目录', 'Emby 转码缓存目录', './transcode'),
        pathField('media_dir', '媒体目录', '影视资源目录', './media'),
      ],
      groups: [],
    },
    compose: `services:
  emby:
    image: lscr.io/linuxserver/emby:latest
    container_name: {{container_name}}
    restart: unless-stopped
    environment:
      - TZ={{timezone}}
      - PUID={{puid}}
      - PGID={{pgid}}
    ports:
      - "{{http_port}}:8096"
    volumes:
      - {{config_dir}}:/config
      - {{transcode_dir}}:/transcode
      - {{media_dir}}:/media
`,
  },
  {
    id: 'alist',
    name: 'AList',
    description: '中国 NAS 用户常用的网盘聚合与文件列表服务',
    icon: 'folder',
    args: {
      schema: [
        containerField('alist'),
        puidField(),
        pgidField(),
        portField('http_port', '访问端口', 'AList Web 页面端口', 5244),
        pathField('data_dir', '数据目录', 'AList 数据目录', './data'),
      ],
      groups: [],
    },
    compose: `services:
  alist:
    image: xhofe/alist:latest
    container_name: {{container_name}}
    restart: unless-stopped
    environment:
      - PUID={{puid}}
      - PGID={{pgid}}
      - UMASK=022
    ports:
      - "{{http_port}}:5244"
    volumes:
      - {{data_dir}}:/opt/alist/data
`,
  },
  {
    id: 'moviepilot',
    name: 'MoviePilot',
    description: '中文影视自动化管理服务，适合与下载器和媒体库联动',
    icon: 'sparkles',
    args: {
      schema: [
        containerField('moviepilot'),
        timezoneField(),
        puidField(),
        pgidField(),
        portField('http_port', '访问端口', 'MoviePilot Web 页面端口', 3000),
        pathField('config_dir', '配置目录', 'MoviePilot 配置目录', './config'),
        pathField('media_dir', '媒体目录', '媒体文件目录', './media'),
        pathField('downloads_dir', '下载目录', '下载器共享目录', './downloads'),
      ],
      groups: [],
    },
    compose: `services:
  moviepilot:
    image: jxxghp/moviepilot:latest
    container_name: {{container_name}}
    restart: unless-stopped
    environment:
      - TZ={{timezone}}
      - PUID={{puid}}
      - PGID={{pgid}}
      - NGINX_PORT={{http_port}}
    ports:
      - "{{http_port}}:3000"
    volumes:
      - {{config_dir}}:/config
      - {{media_dir}}:/media
      - {{downloads_dir}}:/downloads
`,
  },
  {
    id: 'chinese-sub-finder',
    name: 'ChineseSubFinder',
    description: '自动下载中文字幕，中文影视用户常见增强组件',
    icon: 'captions.bubble',
    args: {
      schema: [
        containerField('chinese-sub-finder'),
        timezoneField(),
        puidField(),
        pgidField(),
        portField('http_port', '访问端口', 'ChineseSubFinder Web 页面端口', 19035),
        pathField('config_dir', '配置目录', 'ChineseSubFinder 配置目录', './config'),
        pathField('media_dir', '媒体目录', '需要扫描字幕的媒体目录', './media'),
      ],
      groups: [],
    },
    compose: `services:
  chinese-sub-finder:
    image: allanpk716/chinesesubfinder:latest
    container_name: {{container_name}}
    restart: unless-stopped
    environment:
      - TZ={{timezone}}
      - PUID={{puid}}
      - PGID={{pgid}}
    ports:
      - "{{http_port}}:19035"
    volumes:
      - {{config_dir}}:/config
      - {{media_dir}}:/media
`,
  },
  {
    id: 'qinglong',
    name: '青龙',
    description: '中文 NAS 用户常用的定时任务与脚本面板',
    icon: 'terminal',
    args: {
      schema: [
        containerField('qinglong'),
        timezoneField(),
        portField('http_port', '访问端口', '青龙 Web 页面端口', 5700),
        pathField('data_dir', '数据目录', '青龙数据目录', './data'),
      ],
      groups: [],
    },
    compose: `services:
  qinglong:
    image: whyour/qinglong:latest
    container_name: {{container_name}}
    restart: unless-stopped
    environment:
      - TZ={{timezone}}
    ports:
      - "{{http_port}}:5700"
    volumes:
      - {{data_dir}}:/ql/data
`,
  },
  {
    id: 'lucky',
    name: 'Lucky',
    description: '中文 NAS 常用的 DDNS、反代与内网穿透工具，默认 host 网络',
    icon: 'wand.and.rays',
    args: {
      schema: [
        containerField('lucky'),
        pathField('config_dir', '配置目录', 'Lucky 配置目录', './luckyconf'),
      ],
      groups: [],
    },
    compose: `services:
  lucky:
    image: zhz1021/lucky:latest
    container_name: {{container_name}}
    restart: always
    network_mode: host
    volumes:
      - {{config_dir}}:/goodluck
`,
  },
  {
    id: 'ddns-go',
    name: 'ddns-go',
    description: '轻量级 DDNS 服务，默认 host 网络并直接暴露管理界面',
    icon: 'globe.asia.australia',
    args: {
      schema: [
        containerField('ddns-go'),
        pathField('config_dir', '配置目录', 'ddns-go 配置目录', './data'),
      ],
      groups: [],
    },
    compose: `services:
  ddns-go:
    image: jeessy/ddns-go:latest
    container_name: {{container_name}}
    restart: always
    network_mode: host
    volumes:
      - {{config_dir}}:/root
`,
  },
  {
    id: 'cloudreve',
    name: 'Cloudreve',
    description: '自建网盘与分享服务，默认使用内置 SQLite 模式降低部署成本',
    icon: 'icloud',
    args: {
      schema: [
        containerField('cloudreve'),
        portField('http_port', '访问端口', 'Cloudreve Web 页面端口', 5212),
        pathField('uploads_dir', '上传目录', '用户上传文件目录', './uploads'),
        pathField('config_dir', '配置目录', 'Cloudreve 配置与数据库目录', './config'),
      ],
      groups: [],
    },
    compose: `services:
  cloudreve:
    image: cloudreve/cloudreve:latest
    container_name: {{container_name}}
    restart: unless-stopped
    ports:
      - "{{http_port}}:5212"
    volumes:
      - {{uploads_dir}}:/cloudreve/uploads
      - {{config_dir}}:/cloudreve/conf
`,
  },
  {
    id: 'clouddrive2',
    name: 'CloudDrive2',
    description: '中文用户常用的网盘挂载工具，需宿主机支持 FUSE 与共享挂载',
    icon: 'externaldrive.connected.to.line.below',
    args: {
      schema: [
        timezoneField(),
        pathField('mount_dir', '挂载目录', '接受网盘挂载结果的宿主机目录', './CloudNAS'),
        pathField('config_dir', '配置目录', 'CloudDrive2 配置目录', './Config'),
        pathField('media_dir', '媒体共享目录', '可选的本地媒体共享目录', './media'),
      ],
      groups: [],
    },
    compose: `services:
  clouddrive2:
    image: cloudnas/clouddrive2:latest
    container_name: clouddrive2
    restart: unless-stopped
    environment:
      - TZ={{timezone}}
      - CLOUDDRIVE_HOME=/Config
    volumes:
      - {{mount_dir}}:/CloudNAS:shared
      - {{config_dir}}:/Config
      - {{media_dir}}:/media:shared
    devices:
      - /dev/fuse:/dev/fuse
    pid: host
    privileged: true
    network_mode: host
`,
  },
  {
    id: 'aria2',
    name: 'Aria2',
    description: '轻量级多协议下载器，适合做离线下载与脚本联动',
    icon: 'arrow.down.to.line',
    args: {
      schema: [
        containerField('aria2'),
        timezoneField(),
        portField('rpc_port', 'RPC 端口', 'Aria2 RPC 端口', 6800),
        stringField('rpc_secret', 'RPC 密钥', 'Aria2 RPC 鉴权密钥', 'myservers'),
        pathField('config_dir', '配置目录', 'Aria2 配置目录', './config'),
        pathField('downloads_dir', '下载目录', '下载文件目录', './downloads'),
      ],
      groups: [],
    },
    compose: `services:
  aria2:
    image: p3terx/aria2-pro:latest
    container_name: {{container_name}}
    restart: unless-stopped
    environment:
      - TZ={{timezone}}
      - RPC_SECRET={{rpc_secret}}
    ports:
      - "{{rpc_port}}:6800"
      - "6888:6888"
      - "6888:6888/udp"
    volumes:
      - {{config_dir}}:/config
      - {{downloads_dir}}:/downloads
`,
  },
];

fs.rmSync(templatesRoot, { recursive: true, force: true });
fs.mkdirSync(templatesRoot, { recursive: true });

const index = templates.map(({ id, name, description, icon }) => ({
  id,
  name,
  description,
  icon,
  docker_compose_path: `templates/${id}/docker-compose.yaml`,
  args_path: `templates/${id}/args.json`,
}));

for (const template of templates) {
  const dir = path.join(templatesRoot, template.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'args.json'), JSON.stringify(template.args, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'docker-compose.yaml'), template.compose);
}

fs.writeFileSync(path.join(templatesRoot, 'index.json'), JSON.stringify(index, null, 2) + '\n');

console.log(`Generated ${templates.length} templates.`);
