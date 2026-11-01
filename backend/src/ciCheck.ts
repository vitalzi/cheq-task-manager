// Temporary: proves a lint error stops the pipeline before the AWS steps
async function save(): Promise<void> {}

export function run(): void {
  save();
  const unused = 1;
}
