import { Routes, Route } from 'react-router-dom'
import SetupWizard from './pages/SetupWizard'
import StoryEditor from './pages/StoryEditor'
import GamePlayer from './pages/GamePlayer'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<SetupWizard />} />
        <Route path="/editor" element={<StoryEditor />} />
        <Route path="/play" element={<GamePlayer />} />
      </Routes>
    </div>
  )
}

export default App
