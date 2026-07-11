import { Command } from 'commander';
import { registerCheckCommand } from './commands/check.js';
import { registerScanCommand } from './commands/scan.js';

const program = new Command();

program
  .name('graveyard-check')
  .description('Find maintained successors for abandoned dependencies')
  .version('0.1.0');

registerScanCommand(program);
registerCheckCommand(program);

program.parse();
