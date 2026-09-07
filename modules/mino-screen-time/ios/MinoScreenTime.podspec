require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'MinoScreenTime'
  s.version        = package['version']
  s.summary        = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platforms      = { :ios => '16.0' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/Juliezucc/Mino' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  # Un seul fichier, et c'est délibéré. Ce qui repose le bouclier vit dans
  # `targets/MinoShieldMonitor/` : c'est une cible d'extension, pas
  # l'application. Compilé ici, il ne serait jamais réveillé par le système —
  # et le bouclier ne reviendrait jamais tout seul.
  s.source_files = 'MinoScreenTimeModule.swift'
end
