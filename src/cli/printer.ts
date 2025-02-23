import type { PageAnalysis, Plan, Action, ActionStatus, ActionResult } from '../types';
import chalk from 'chalk';
import { getActionSymbol, getActionDescription } from '../utils/actions';

export type OutputFormat = 'pretty' | 'json';

export function printPlan(plan: Plan): void {
  console.log('\n📋', chalk.bold('Plan to Execute:'));
  console.log('='.repeat(50));
  plan.actions.forEach((action, index) => {
    const symbol = getActionSymbol(action);
    console.log(`${symbol} Step ${index + 1}/${plan.actions.length}: ${getActionDescription(action)}`);
  });
  console.log('='.repeat(50), '\n');
}

export function printActionStatus(status: ActionStatus): void {
  const { step, totalSteps, symbol, description, result } = status;
  
  // Print the action header
  console.log(`\n${symbol} [${step}/${totalSteps}] ${description}`);
  
  // Print the result if available
  if (result) {
    if (result.success) {
      console.log(chalk.green(`✅ ${result.message}`));
    }
    if (result.warning) {
      console.log(chalk.yellow(`⚠️  ${result.warning}`));
    }
    if (result.error) {
      console.log(chalk.red(`❌ ${result.error}`));
    }
  }
}

export function printActionSummary(statuses: ActionStatus[]): void {
  const total = statuses.length;
  const successful = statuses.filter(s => s.result?.success).length;
  const failed = total - successful;
  
  console.log('\n📊', chalk.bold('Action Summary:'));
  console.log('='.repeat(50));
  console.log(`Total Actions: ${total}`);
  console.log(`Successful: ${chalk.green(successful)}`);
  if (failed > 0) {
    console.log(`Failed: ${chalk.red(failed)}`);
  }
  console.log('='.repeat(50), '\n');
}

export function printAnalysis(analysis: PageAnalysis, format: OutputFormat = 'pretty'): void {
  if (format === 'json') {
    console.log(JSON.stringify(analysis, null, 2));
    return;
  }

  console.log('\n📄', chalk.bold('Page Analysis:'));
  console.log('='.repeat(50));
  console.log(chalk.bold('Title:'), chalk.cyan(analysis.title));
  if (analysis.description) {
    console.log(chalk.bold('Description:'), chalk.gray(analysis.description));
  }

  if (analysis.inputs?.length) {
    console.log(chalk.bold('\nInputs:'), chalk.cyan(analysis.inputs.length));
    analysis.inputs.forEach(input => {
      console.log(`\n🔤 ${chalk.bold(input.label || input.type)}`);
      console.log(chalk.gray(`  Type: ${input.type}`));
      if (input.id) console.log(chalk.gray(`  ID: ${input.id}`));
      if (input.role) console.log(chalk.gray(`  Role: ${input.role}`));
      if (!input.isVisible) console.log(chalk.yellow('  Hidden: true'));
      console.log(chalk.gray(`  Selector: ${input.selector}`));
    });
  }

  if (analysis.buttons?.length) {
    console.log(chalk.bold('\nButtons:'), chalk.cyan(analysis.buttons.length));
    analysis.buttons.forEach(button => {
      console.log(`\n🔘 ${chalk.bold(button.text || 'No text')}`);
      console.log(chalk.gray(`  Selector: ${button.selector}`));
    });
  }

  if (analysis.links?.length) {
    console.log(chalk.bold('\nLinks:'), chalk.cyan(analysis.links.length));
    analysis.links.forEach(link => {
      console.log(`\n🔗 ${chalk.bold(link.title || 'No title')}`);
      console.log(chalk.gray(`  URL: ${link.url}`));
      console.log(chalk.gray(`  Selector: ${link.selector}`));
    });
  }

  if (analysis.plannedActions?.length) {
    console.log(chalk.bold('\nPlanned Actions Results:'), chalk.cyan(analysis.plannedActions.length));
    analysis.plannedActions.forEach(action => {
      console.log(`\n📝 ${chalk.bold(action.selector)}`);
      if (action.html) {
        // Print full HTML without truncation
        console.log(chalk.gray(`  HTML:\n${action.html}`));
      } else {
        console.log(chalk.yellow('  HTML: Not captured'));
      }
      if (action.error) {
        console.log(chalk.red(`  Error: ${action.error}`));
      }
    });
  }

  console.log('\n' + '='.repeat(50));
} 