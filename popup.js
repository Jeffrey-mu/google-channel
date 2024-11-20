document.getElementById('getData').addEventListener('click', async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  let searchType = document.querySelector('input[name="searchType"]:checked').value
  let input = document.getElementById('textarea').value
  let channelCount = document.getElementById('channelCount').value
  if (!input && !channelCount) {
    return
  }
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [input, searchType, channelCount],
    function: async (inputText, searchType, channelCount) => {  
      // 辅助函数：等待元素出现
      function waitForElement(selector, filterFn, timeout = 5000) {
        return new Promise((resolve, reject) => {
          const checkElement = () => {
            const elements = Array.from(document.querySelectorAll(selector))
            const targetElement = elements.find(filterFn)
            return targetElement
          }

          // 先检查元素是否已存在
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
          // 等待1秒确保页面准备好
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // 点击添加渠道按钮
          const addButton = await waitForElement('.mdc-button__ripple', (element) => {
            const button = element.closest('button') || element.parentElement
            return button.textContent.trim().includes('添加渠道')
          })
          const addButtonToClick = addButton.closest('button') || addButton.parentElement
          addButtonToClick.click()
          
          // 等待并点击下拉菜单
          const dropdown = await waitForElement('material-dropdown-select dropdown-button div', (element) => {
            return element.textContent.trim().includes('选择产品')
          })
          dropdown.click()
          
          // 等待下拉菜单完全展开
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // 选择产品类型
          const option = await waitForElement('material-list material-select-dropdown-item', (element) => {
            return element.textContent.trim().includes(searchType)
          })
          option.click()
          
          // 等待输入框准备好
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // 输入渠道信息
          const channel_input = document.querySelector('create-form material-input input')
          channel_input.value = channel
          channel_input.dispatchEvent(new Event('input', { bubbles: true }))
          
          // 点击保存按钮
          const saveButton = await waitForElement('create-form material-ripple', (element) => {
            const button = element.closest('button') || element.parentElement
            return button.textContent.trim().includes('保存')
          })
          const saveButtonToClick = saveButton.closest('button') || saveButton.parentElement
          saveButtonToClick.click()
          
          // 等待保存操作完成
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          console.log(`Successfully processed channel: ${channel}`)
          return true
        } catch (error) {
          console.error(`Error processing channel ${channel}:`, error)
          return false
        }
      }

      // 主处理逻辑
      let channels = inputText.split('\n').map(item => item.trim())
      if (channelCount) {
        channels = Array.from({ length: channelCount }, (_, index) => `渠道${index + 1}`)
      }
      for (const channel of channels) {
        let retryCount = 3 // 最大重试次数
        let success = false
        
        while (retryCount > 0 && !success) {
          success = await processChannel(channel)
          if (!success) {
            console.log(`Retrying channel ${channel}, ${retryCount - 1} attempts remaining`)
            retryCount--
            // 重试前等待2秒
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
        
        if (!success) {
          console.error(`Failed to process channel ${channel} after all retry attempts`)
        }
      }
    }
  })
})



