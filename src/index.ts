import { config } from "@dotenvx/dotenvx";

import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import debug from "debug";

import { PayPalAgentToolkit } from '@paypal/agent-toolkit/ai-sdk'
import { generateId, generateText, Message } from "ai";

import { systemPromptInvocing, systemPromptPaymentShipping } from "src/constants/systemPrompt";
import { getDeepSeekModel, getVolcanoModel } from "./utils/llm/model"


const logger = debug('cmd-line-bot');
const envFilePath = process.env.ENV_FILE_PATH;
config({ path: envFilePath })

const ppConfig = {
    clientId: process.env.PAYPAL_CLIENT_ID || "",
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || "",
    environment: process.env.PAYPAL_ENVIRONMENT || "Sandbox",
    logRequestDetails: process.env.PAYPAL_LOG_REQUESTS || "false",
    logResponseDetails: process.env.PAYPAL_LOG_RESPONSES || "false",
    debug: process.env.PAYPAL_DEBUG_FLOWS || "false",
}

//Conservation History
let messageHistory: Message[] = []

console.clear();
console.log(chalk.greenBright.bold("Welcome, let's get start!"));
console.log(chalk.gray("Type 'exit' to quit or 'clear' to reset memory.\n"))


const chat = async () => {
    const paypalToolkit = new PayPalAgentToolkit({
        clientId: ppConfig.clientId,
        clientSecret: ppConfig.clientSecret,
        configuration: {
            actions: {
                // invoices: {
                //     create: true,
                //     list: true,
                //     send: true,
                //     generateQRC: true
                // },
                products: {
                    create: true,
                    list: true,
                    show: true
                },
                orders: {
                    create: true,
                    get: true
                }
            },
            context: {
                sandbox: true
            }
        }
    })
    const tools = { ...paypalToolkit.getTools() };

    const llm = getVolcanoModel();
    // const llm = getDeepSeekModel();

    while (true) {
        const { userInput } = await inquirer.prompt([
            {
                type: 'input',
                name: 'userInput',
                message: chalk.yellowBright("You:")
            }
        ])

        const command = userInput.toLowerCase();
        if (command === 'exit') {
            console.log(chalk.yellow('\nGoodbye!'));
        }

        if (command === 'clear') {
            messageHistory = [];
            console.log("Chat history cleared. Starting fresh...\n");
            continue;
        }

        messageHistory.push({
            id: generateId(),
            role: 'user',
            content: userInput
        })

        const spinner = ora("Agent is thinking...").start();

        const { text } = await generateText({
            model: llm,
            messages: messageHistory,
            tools,
            // system: systemPromptInvocing,
            system: systemPromptPaymentShipping,
            maxRetries: 1,
            maxSteps: 3,
            onStepFinish: ({ toolCalls, toolResults }) => {
                logger("[Tool Calls]:", JSON.stringify(toolCalls, null, 2))
                logger("[Tool Results]:", JSON.stringify(toolResults, null, 2))
            }
        });

        spinner.stop();
        messageHistory.push({
            id: generateId(),
            role: "assistant",
            content: text
        })

        console.log(chalk.blueBright("\nPayPalBot: " + text + '\n'))

    }
}

chat();