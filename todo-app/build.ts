import { $ } from "bun";
import tailwind from "bun-plugin-tailwind";

const root = process.cwd();
const outdir = `${root}/dist`;
await $`rm -rf ${outdir}`;

const entrypoints = [...new Bun.Glob("src/**/*.html").scanSync()];

const result = await Bun.build({
  entrypoints,
  outdir,
  plugins: [tailwind],
  minify: true,
  target: "browser",
  sourcemap: "linked",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});

for (const output of result.outputs) {
  const rel = output.path.startsWith(root) ? output.path.slice(root.length + 1) : output.path;
  console.log(` ${rel}  ${(output.size / 1024).toFixed(1)} KB`);
}
