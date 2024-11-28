document.getElementById('getData').addEventListener('click', async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  let searchType = document.querySelector('input[name="searchType"]:checked').value
  let input = document.getElementById('textarea').value
  let channelCount = document.getElementById('channelCount').value
  const resultDiv = document.getElementById('result')
  
  if (!input && !channelCount) {
    resultDiv.innerHTML = `
      <div class="text-red-500">请输入渠道名称或渠道数量</div>
    `
    return
  }

  // 初始化结果显示
  resultDiv.innerHTML = `
    <div class="space-y-2">
      <div class="flex items-center">
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
        <span class="text-gray-600">正在处理中...</span>
      </div>
      <div class="text-sm">
        <div class="text-green-600">✓ 成功添加: <span id="successCount">0</span> 个渠道</div>
        <div class="text-gray-500" id="progress"></div>
      </div>
    </div>
  `

  // 设置消息监听器
  const messageListener = (message) => {
    if (message.type === 'CHANNEL_PROGRESS') {
      const { current, total, success } = message.data
      document.getElementById('successCount').textContent = success
      document.getElementById('progress').textContent = `进度: ${current}/${total}`
    }
  }

  // 添加消息监听
  chrome.runtime.onMessage.addListener(messageListener)

  try {
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (inputText, searchType, channelCount) => {
        // 辅助函数：等待元素出现
        function waitForElement(selector, filterFn, timeout = 5000) {
          return new Promise((resolve, reject) => {
            const checkElement = () => {
              const elements = Array.from(document.querySelectorAll(selector))
              const targetElement = elements.find(filterFn)
              return targetElement
            }

            const element = checkElement()
            if (element) {
              return resolve(element)
            }

            const observer = new MutationObserver(() => {
              const element = checkElement()
              if (element) {
                resolve(element)
                observer.disconnect()
              }
            })

            observer.observe(document.body, {
              childList: true,
              subtree: true
            })

            setTimeout(() => {
              observer.disconnect()
              reject('Timeout waiting for element')
            }, timeout)
          })
        }

        // 处理单个渠道的函数
        async function processChannel(channel) {
          try {
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            const addButton = await waitForElement('.mdc-button__ripple', (element) => {
              const button = element.closest('button') || element.parentElement
              return button.textContent.trim().includes('添加渠道')
            })
            addButton.closest('button').click()
            
            await new Promise(resolve => setTimeout(resolve, 500))
            
            const dropdown = await waitForElement('material-dropdown-select dropdown-button div', (element) => {
              return element.textContent.trim().includes('选择产品')
            })
            dropdown.click()
            
            await new Promise(resolve => setTimeout(resolve, 500))
            
            const option = await waitForElement('material-list material-select-dropdown-item', (element) => {
              return element.textContent.trim().includes(searchType)
            })
            option.click()
            
            await new Promise(resolve => setTimeout(resolve, 500))
            
            const channel_input = document.querySelector('create-form material-input input')
            channel_input.value = channel
            channel_input.dispatchEvent(new Event('input', { bubbles: true }))
            
            const saveButton = await waitForElement('create-form material-ripple', (element) => {
              const button = element.closest('button') || element.parentElement
              return button.textContent.trim().includes('保存')
            })
            saveButton.closest('button').click()
            
            await new Promise(resolve => setTimeout(resolve, 1000))
            return true
          } catch (error) {
            console.error(`Error processing channel ${channel}:`, error)
            return false
          }
        }

        // 修改进度更新方式
        async function updateProgress(current, total, success, failed) {
          try {
            await chrome.runtime.sendMessage({
              type: 'CHANNEL_PROGRESS',
              data: { current, total, success, failed }
            })
          } catch (error) {
            console.error('Failed to send progress update:', error)
          }
        }

        let channels = inputText ? inputText.split('\n').filter(Boolean).map(item => item.trim()) 
                                : Array.from({ length: parseInt(channelCount) }, (_, i) => `渠道${i + 1}`)
        
        const results = {
          total: channels.length,
          success: 0,
          failed: 0,
          failedChannels: []
        }

        for (let i = 0; i < channels.length; i++) {
          const channel = channels[i]
          let success = false
          let attempts = 3

          while (attempts > 0 && !success) {
            success = await processChannel(channel)
            if (!success) {
              attempts--
              await new Promise(resolve => setTimeout(resolve, 2000))
            }
          }

          if (success) {
            results.success++
          } else {
            results.failed++
            results.failedChannels.push(channel)
          }

          // 使用新的进度更新函数
          await updateProgress(i + 1, channels.length, results.success, results.failed)
        }

        return results
      },
      args: [input, searchType, channelCount]
    })

    // 处理最终结果
    const results = injectionResults[0].result
    if (results) {
      resultDiv.innerHTML = `
        <div class="space-y-2">
          <div class="text-gray-700 font-medium">处理完成</div>
          <div class="text-sm">
            <div class="text-green-600">✓ 成功添加: ${results.success} 个渠道</div>
            ${results.failed > 0 ? `
              <div class="text-red-500 mt-1">
                ✕ 失败: ${results.failed} 个渠道
                ${results.failedChannels.length > 0 ? `
                  <div class="text-xs mt-1">
                    失败渠道: ${results.failedChannels.join(', ')}
                  </div>
                ` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      `
    }
  } catch (error) {
    resultDiv.innerHTML = `
      <div class="text-red-500">执行过程中发生错误: ${error.message}</div>
    `
  } finally {
    // 清理消息监听器
    chrome.runtime.onMessage.removeListener(messageListener)
  }
})



