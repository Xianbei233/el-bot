import Bot from "el-bot";
import QRCode from "qrcode";
import { Message, MessageType } from "mirai-ts";
import fs from "fs";
import { resolve } from "path";

/**
 * 生成二维码
 * @param text
 * @param folder 目标文件夹
 */
async function generateQR(text: string, folder: string) {
  const timestamp = new Date().valueOf();
  const filename = `${timestamp}.png`;
  await QRCode.toFile(`${folder}/${filename}`, text);
  return filename;
}

export default function (ctx: Bot) {
  const { cli } = ctx;

  const folder = resolve(
    process.cwd(),
    ctx.el.pkg.mcl.folder,
    `data/net.mamoe.mirai-api-http/images/qrcode`
  );

  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }

  cli
    .command("qrcode <text...>")
    .description("生成二维码")
    .action(async (text: string[]) => {
      const msg = ctx.mirai.curMsg;
      const filename = await generateQR(text.join(" "), folder);
      const chain = [Message.Image(null, null, `qrcode/${filename}`)];
      (msg as MessageType.ChatMessage).reply(chain);
    });
}
