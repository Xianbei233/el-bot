import Bot from ".";
import { merge } from "../utils/config";
import path from "path";
import { isFunction } from "../shared";

type PluginInstallFunction = (bot: Bot, ...options: any[]) => any;

export type Plugin =
  | (PluginInstallFunction & {
      name?: string;
      version?: string;
      description?: string;
      install?: PluginInstallFunction;
    })
  | {
      install: PluginInstallFunction;
    };

export interface PluginInfo {
  name: string;
  version?: string;
  description?: string;
}

export type PluginType = "default" | "official" | "community" | "custom";

export const PluginTypeMap: Record<PluginType, string> = {
  default: "默认插件",
  official: "官方插件",
  community: "社区插件",
  custom: "自定义插件",
};

export default class Plugins {
  default = new Set<PluginInfo>();
  official = new Set<PluginInfo>();
  community = new Set<PluginInfo>();
  custom = new Set<PluginInfo>();
  constructor(public bot: Bot) {}

  /**
   * 根据名称判断是否为官方插件
   * @param name
   */
  isOfficial(name: string) {
    return name.startsWith("@el-bot/plugin-");
  }

  /**
   * 根据名称判断是否为社区插件
   * @param name
   */
  isCommunity(name: string) {
    return name.startsWith("el-bot-plugin-");
  }

  /**
   * 根据插件类型，获得插件标准全名或路径
   * @param name
   */
  getPluginFullName(name: string, type: PluginType) {
    let pkgName = name;
    switch (type) {
      case "default":
        pkgName = `../plugins/${name}`;
        break;
      case "official":
        pkgName = `@el-bot/plugin-${name}`;
        break;
      case "community":
        pkgName = `el-bot-plugin-${name}`;
        break;
      case "custom":
        pkgName = path.resolve(process.cwd(), name);
        break;
      default:
        break;
    }
    return pkgName;
  }

  /**
   * 加载对应类型插件
   * @param type 插件类型 default | custom
   * @param path 所在路径
   */
  load(type: PluginType) {
    const config = this.bot.el.config;
    if (config.plugins[type]) {
      config.plugins[type].forEach(async (name: string) => {
        const pkgName = this.getPluginFullName(name, type);

        try {
          const pluginPath = pkgName;
          const { default: plugin } = await import(pluginPath);

          let pkg = {
            name: pkgName,
            version: "未知",
            description: "未知",
          };
          try {
            pkg = await import(`${pluginPath}/package.json`);
          } catch {
            this.bot.logger.warning(`${name} 插件没有相关描述信息`);
          }

          if (plugin) {
            this[type].add({
              name: name || pkgName,
              version: plugin.version || pkg.version,
              description: plugin.description || pkg.description,
            });

            let options = null;
            try {
              const { default: defaultOptions } = await import(
                `${pluginPath}/options`
              );
              options = defaultOptions;
            } catch {
              // this.bot.logger.error(`${pkgName}不存在默认配置`)
            }

            name = path.basename(name);
            this.add(name, plugin, options, pkg);

            this.bot.logger.success(`[${type}] (${name}) 加载成功`);
          }
        } catch (err) {
          this.bot.logger.error(err.message);
          this.bot.logger.error(`[${type}] (${name}) 加载失败`);
        }
      });
    }
  }

  /**
   * 是否依赖于数据库
   * @param pkg
   */
  isBasedOnDb(pkg: any): boolean {
    return pkg["el-bot"] && pkg["el-bot"].db && !this.bot.db;
  }

  /**
   * 添加插件
   * @param name 插件名
   * @param plugin 插件函数
   * @param options 默认配置
   * @param pkg 插件 package.json
   */
  add(name: string, plugin: Plugin, options?: any, pkg?: any) {
    const bot = this.bot;

    // 插件基于数据库，但是未启用数据库时
    if (pkg && this.isBasedOnDb(pkg)) {
      this.bot.logger.warning(
        `[${pkg.name}] 如想要使用该插件，您须先启用数据库。`
      );
      return;
    }

    // 加载配置项
    let pluginOptions = this.bot.el.config[name];
    if (options) {
      if (this.bot.el.config[name]) {
        pluginOptions = merge(options, this.bot.el.config[name]);
      } else {
        pluginOptions = options;
      }
    }

    if (plugin && isFunction(plugin.install)) {
      plugin.install(bot, pluginOptions);
    } else if (isFunction(plugin)) {
      plugin(bot, pluginOptions);
    } else if (bot.isDev) {
      bot.logger.warn('插件必须是一个函数，或是带有 "install" 属性的对象。');
    }
  }

  /**
   * 插件列表
   * @param type 插件类型
   */
  list(type: PluginType) {
    const pluginTypeName = PluginTypeMap[type];
    let content = `无${pluginTypeName}\n`;
    if (this[type].size > 0) {
      content = pluginTypeName + ":\n";
      this[type].forEach((plugin: PluginInfo) => {
        content += `- ${plugin.name}@${plugin.version}: ${plugin.description}\n`;
      });
    }
    return content;
  }
}
