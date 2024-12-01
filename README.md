Generate Graphics and FPS cheats based off UE4cfgdumper directly on your NX
Project is using nx.js

## Creating custom configs 
### Example 
```json
{
  "enableCategories": "true",
  "markDefaultValues": "true",
  "cheatOptions": [
    {
      "name": "60 FPS",
      "options": [
        {"r.DynamicRes.FrameTimeBudget": "41855555"},
        {"rhi.SyncInterval": "1"},
        {"r.Vsync": "0"},
        {"t.MaxFPS": "0"},
        {"r.GTSyncType": "1"}
      ],
      "category": "Framerate"
    }
  ]
}
```

## Current Issues
- Function to mark default values is currently broken 
- Controller input

## Planned Features
- FPSLocker Configs
- Custom Configurations
- Toggle Categories
- Setup/Update UE4cfgdumper